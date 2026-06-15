// 一次性运维脚本：把 chunk 向量的 metadata.scopeId 从 "default" 迁移到 "personal"。
//
// 背景：一期引入 scope 隔离（人记忆 personal / agent 记忆 agent），检索默认只查 personal。
// 现网历史向量写于 scope 改造之前，metadata.scopeId="default"，若不重打标会被 personal
// 过滤器挡住而召回不到。本脚本只重写 scopeId，不重算、不 reprocess。
//
// 用法（部署序列里执行）：
//   1. wrangler vectorize get-vectors cloudmind-asset-chunks --ids <空格分隔的多个 vector_id> > raw.json
//      （--ids 是 wrangler 的数组参数，多个 id 用空格分隔；切勿传逗号拼接的单串，会被当成一个 id）
//   2. node scripts/ops/rescope-chunk-vectors.mjs raw.json > rescoped.ndjson
//   3. wrangler vectorize upsert cloudmind-asset-chunks --file rescoped.ndjson
//
// 设计要点：
//   - 只改 scopeId，保留其它 metadata（aiVisibility/domain/sourceKind/... 原样），绝不重算。
//   - 幂等：已是 personal 的跳过；遇到既非 default 也非 personal 的值直接报错中止（防误伤）。
//   - aiVisibility=deny 的向量（如 firewall 笔记 d6402da4）不应进入输入——调用方在
//     get-vectors 选 id 阶段就排除掉，本脚本不负责过滤可见性。
//   - 统计信息走 stderr，干净的 NDJSON 只走 stdout，便于直接重定向到文件。

import { readFileSync } from "node:fs";

const FROM_SCOPE = "default";
const TO_SCOPE = "personal";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error(
    "usage: node rescope-chunk-vectors.mjs <raw-get-vectors-output.json>"
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
