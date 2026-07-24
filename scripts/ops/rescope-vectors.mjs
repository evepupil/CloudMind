// 一次性运维脚本：补齐向量的三维归属 metadata。
// 与具体 index 无关——纯转换：读 get-vectors 原始输出 → 补 metadata → 输出 NDJSON。
// 同一脚本服务两类向量：L1 chunk 向量（cloudmind-asset-chunks）与 L2 实体向量（graph_entities）。
//
// 背景：一期/二期引入 scope 隔离（人记忆 personal / agent 记忆 agent），检索默认只查 personal，
// 且 Vectorize 原生 metadata 过滤只命中【带该字段】的向量。现网历史向量写于 scope 改造之前：
// chunk 向量 metadata.scopeId="default"，实体向量 metadata 只有 {canonicalName}（无 scopeId）。
// 若不补打 scopeId，部署后会被 personal 过滤器整体挡住——人记忆自身的语义检索 / 图检索种子 /
// 实体去重全部失效。本脚本只重写 scopeId，不重算、不 reprocess。
//
// ── Pass A：chunk 向量（cloudmind-asset-chunks）──
//   1. 选 id：从 D1 取【非 deny】chunk 向量 id（ai_visibility != 'deny'，firewall 笔记不动）：
//      wrangler d1 execute cloudmind --remote --json \
//        --command "SELECT vector_id FROM asset_chunks WHERE vector_id IS NOT NULL
//                   AND asset_id NOT IN (SELECT id FROM assets WHERE ai_visibility = 'deny')"
//   2. get-vectors → 转换 → upsert：
//      wrangler vectorize get-vectors cloudmind-asset-chunks --ids <空格分隔多个 id> > raw.json
//      node scripts/ops/rescope-vectors.mjs raw.json --scope-id personal \
//        --context-key global --record-kind library > rescoped.ndjson
//      wrangler vectorize upsert cloudmind-asset-chunks --file rescoped.ndjson
//
// ── Pass B：实体向量（graph_entities，二期新增）──
//   0. 先声明 metadata 索引（必须在 upsert 前；只影响之后写入的向量）：
//      wrangler vectorize create-metadata-index graph_entities --property-name=scopeId --type=string
//   1. 选 id：【D1 驱动】取所有有向量的实体 id，覆盖所有实体（包括之后不再被提及的）：
//      wrangler d1 execute cloudmind --remote --json \
//        --command "SELECT embedding_vector_id FROM entities WHERE embedding_vector_id IS NOT NULL"
//      （务必 D1 驱动而非靠 reprocess——reprocess 只覆盖被重新提及的实体，merge 分支还会
//        改变 vectorId，漏标的实体会被 personal 过滤器永久挡住。）
//   2. get-vectors → 转换 → upsert：
//      wrangler vectorize get-vectors graph_entities --ids <空格分隔多个 id> > raw.json
//      node scripts/ops/rescope-vectors.mjs raw.json --scope-id personal \
//        --context-key global > rescoped.ndjson
//      wrangler vectorize upsert graph_entities --file rescoped.ndjson
//
// 注：--ids 是 wrangler 的数组参数，多个 id 用空格分隔；切勿传逗号拼接的单串，会被当成一个 id。
//
// 设计要点：
//   - 只改显式指定的字段，保留其它 metadata（chunk 的 aiVisibility/domain/... 与实体的 canonicalName
//     原样），绝不重算。
//   - 幂等：已等于目标值的字段跳过；缺失字段才补齐，已有冲突值直接报错中止（防误伤）。
//   - 可见性过滤在【选 id】阶段完成（Pass A 的 D1 查询已排除 deny），本脚本不负责过滤可见性。
//   - 现网为单用户、全 personal，故统一迁到 personal；多 scope 落地后再按 D1 scope_id 分别打标。
//   - 统计信息走 stderr，干净的 NDJSON 只走 stdout，便于直接重定向到文件。

import { readFileSync } from "node:fs";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error(
    "usage: node rescope-vectors.mjs <raw-get-vectors-output.json> " +
      "[--scope-id personal|agent] [--context-key global|project:<key>] " +
      "[--record-kind library|memory]"
  );
  process.exit(1);
}

const options = new Map();
for (let index = 3; index < process.argv.length; index += 2) {
  const option = process.argv[index];
  const value = process.argv[index + 1];

  if (!option || !value || !option.startsWith("--")) {
    console.error(`参数格式错误：${option ?? "<missing>"}`);
    process.exit(1);
  }

  options.set(option, value);
}

const scopeId = options.get("--scope-id") ?? "personal";
const contextKey = options.get("--context-key");
const recordKind = options.get("--record-kind");
const knownOptions = new Set(["--scope-id", "--context-key", "--record-kind"]);

for (const option of options.keys()) {
  if (!knownOptions.has(option)) {
    console.error(`未知参数：${option}`);
    process.exit(1);
  }
}

if (!new Set(["personal", "agent"]).has(scopeId)) {
  console.error(`scopeId 非法：${scopeId}`);
  process.exit(1);
}

if (
  contextKey !== undefined &&
  contextKey !== "global" &&
  !contextKey.startsWith("project:")
) {
  console.error(`contextKey 非法：${contextKey}`);
  process.exit(1);
}

if (
  recordKind !== undefined &&
  !new Set(["library", "memory"]).has(recordKind)
) {
  console.error(`recordKind 非法：${recordKind}`);
  process.exit(1);
}

const targets = {
  scopeId,
  ...(contextKey ? { contextKey } : {}),
  ...(recordKind ? { recordKind } : {}),
};

const raw = readFileSync(inputPath, "utf8");
// wrangler 会在 JSON 前打印 banner（⛅️/📋 等纯文本，不含 '['），从第一个 '[' 开始即数组。
const arrayStart = raw.indexOf("[");
if (arrayStart < 0) {
  console.error("找不到 JSON 数组起点，输入可能不是 get-vectors 的输出");
  process.exit(1);
}

const vectors = JSON.parse(raw.slice(arrayStart));
if (!Array.isArray(vectors) || vectors.length === 0) {
  console.error("解析到的向量数组为空，未做任何处理");
  process.exit(1);
}

const lines = [];
let migrated = 0;
let skipped = 0;

for (const vector of vectors) {
  if (
    !vector ||
    typeof vector.id !== "string" ||
    !Array.isArray(vector.values)
  ) {
    console.error(
      `向量结构异常（缺 id/values）：${JSON.stringify(vector?.id)}`
    );
    process.exit(1);
  }

  const metadata = { ...(vector.metadata ?? {}) };
  let changed = false;

  for (const [key, target] of Object.entries(targets)) {
    const current = metadata[key];

    if (current === target) {
      continue;
    }

    if (current === undefined || (key === "scopeId" && current === "default")) {
      metadata[key] = target;
      changed = true;
      continue;
    }

    console.error(
      `向量 ${vector.id} 的 ${key}="${current}" 与目标值 "${target}" 冲突，中止以防误伤`
    );
    process.exit(1);
  }

  if (changed) {
    migrated += 1;
  } else {
    skipped += 1;
  }

  lines.push(
    JSON.stringify({ id: vector.id, values: vector.values, metadata })
  );
}

console.error(
  `metadata 补齐完成：迁移 ${migrated} 条、跳过 ${skipped} 条、合计 ${vectors.length} 条`
);
process.stdout.write(`${lines.join("\n")}\n`);
