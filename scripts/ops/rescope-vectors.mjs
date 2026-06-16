// 一次性运维脚本：把向量的 metadata.scopeId 迁移到 "personal"（兼容旧 "default" 与缺失）。
// 与具体 index 无关——纯转换：读 get-vectors 原始输出 → 改 scopeId → 输出 NDJSON。
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
//      node scripts/ops/rescope-vectors.mjs raw.json > rescoped.ndjson
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
//      node scripts/ops/rescope-vectors.mjs raw.json > rescoped.ndjson
//      wrangler vectorize upsert graph_entities --file rescoped.ndjson
//
// 注：--ids 是 wrangler 的数组参数，多个 id 用空格分隔；切勿传逗号拼接的单串，会被当成一个 id。
//
// 设计要点：
//   - 只改 scopeId，保留其它 metadata（chunk 的 aiVisibility/domain/... 与实体的 canonicalName
//     原样），绝不重算。
//   - 幂等：已是 personal 的跳过；既非 default/未缺失也非 personal 的值直接报错中止（防误伤）。
//   - 可见性过滤在【选 id】阶段完成（Pass A 的 D1 查询已排除 deny），本脚本不负责过滤可见性。
//   - 现网为单用户、全 personal，故统一迁到 personal；多 scope 落地后再按 D1 scope_id 分别打标。
//   - 统计信息走 stderr，干净的 NDJSON 只走 stdout，便于直接重定向到文件。

import { readFileSync } from "node:fs";

const FROM_SCOPE = "default";
const TO_SCOPE = "personal";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error(
    "usage: node rescope-vectors.mjs <raw-get-vectors-output.json>"
  );
  process.exit(1);
}

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
  const current = metadata.scopeId;

  if (current === TO_SCOPE) {
    skipped += 1;
  } else if (current === FROM_SCOPE || current === undefined) {
    metadata.scopeId = TO_SCOPE;
    migrated += 1;
  } else {
    console.error(
      `向量 ${vector.id} 的 scopeId="${current}" 非预期值，中止以防误伤`
    );
    process.exit(1);
  }

  lines.push(
    JSON.stringify({ id: vector.id, values: vector.values, metadata })
  );
}

console.error(
  `re-scope 完成：迁移 ${migrated} 条、跳过(已 personal) ${skipped} 条、合计 ${vectors.length} 条`
);
process.stdout.write(`${lines.join("\n")}\n`);
