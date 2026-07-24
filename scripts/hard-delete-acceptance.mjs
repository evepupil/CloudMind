// M6 生产验收：创建隔离记忆并验证 soft -> hard 后 D1/R2/Vectorize/审计一致。
// 用法：CLOUDMIND_MCP_TOKEN=<token> node scripts/hard-delete-acceptance.mjs

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const baseUrl = (
  process.env.SMOKE_BASE_URL ?? "https://cloudmind.chaosyn.com"
).replace(/\/$/, "");
const token = process.env.CLOUDMIND_MCP_TOKEN;
const database = process.env.M6_DATABASE ?? "cloudmind";
const bucket = process.env.M6_BUCKET ?? "cloudmind-assets";
const assetIndex = process.env.M6_ASSET_INDEX ?? "cloudmind-asset-chunks";
const graphIndex = process.env.M6_GRAPH_INDEX ?? "graph_entities";
const timeoutMs = Number(process.env.SMOKE_READY_TIMEOUT_MS ?? 180000);
const pollMs = Number(process.env.SMOKE_POLL_MS ?? 4000);

if (!token) {
  throw new Error("CLOUDMIND_MCP_TOKEN is required.");
}

const wranglerPath = resolve("node_modules/wrangler/bin/wrangler.js");
const suffix = Date.now().toString(36);
const contextKey = `project:github:evepupil/M6HardDelete-${suffix}`;
const temporaryDirectory = mkdtempSync(
  join(tmpdir(), "cloudmind-hard-delete-acceptance-")
);
const sleep = (milliseconds) =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
const sqlLiteral = (value) => `'${value.replaceAll("'", "''")}'`;

const parseJsonDocument = (text) => {
  for (let offset = 0; offset < text.length; offset += 1) {
    if (text[offset] !== "[" && text[offset] !== "{") {
      continue;
    }

    try {
      return JSON.parse(text.slice(offset));
    } catch {
      // Wrangler 可能在 JSON 前输出进度，继续寻找下一个起点。
    }
  }

  throw new Error(
    "Wrangler did not return JSON during hard delete acceptance."
  );
};

const runWrangler = (args) =>
  spawnSync(process.execPath, [wranglerPath, ...args], {
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
  });

const queryD1 = (sql) => {
  const result = runWrangler([
    "d1",
    "execute",
    database,
    "--remote",
    "--command",
    sql,
    "--json",
  ]);

  if (result.status !== 0) {
    throw new Error("D1 verification failed during hard delete acceptance.");
  }

  const envelopes = parseJsonDocument(result.stdout);
  return Array.isArray(envelopes)
    ? envelopes.flatMap((envelope) => envelope.results ?? [])
    : [];
};

const getVectors = (indexName, ids) => {
  if (ids.length === 0) {
    return [];
  }

  const result = runWrangler([
    "vectorize",
    "get-vectors",
    indexName,
    ...ids.flatMap((id) => ["--ids", id]),
  ]);

  const output = `${result.stdout}\n${result.stderr}`;

  if (/does not contain vectors/i.test(output)) {
    return [];
  }

  if (result.status !== 0) {
    throw new Error(
      "Vectorize verification failed during hard delete acceptance."
    );
  }

  const parsed = parseJsonDocument(result.stdout);
  return Array.isArray(parsed) ? parsed : (parsed.vectors ?? []);
};

const authedFetch = (input, init = {}) => {
  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
};
const client = new Client({
  name: "hard-delete-acceptance",
  version: "0.1.0",
});
const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
  fetch: authedFetch,
});

const call = async (name, args) => {
  const result = await client.callTool({ name, arguments: args });

  if (result.isError || typeof result.structuredContent !== "object") {
    throw new Error(`MCP ${name} failed during hard delete acceptance.`);
  }

  return result.structuredContent;
};

let createdId;
let hardDeleted = false;
let phase = "connect";

try {
  await client.connect(transport);
  phase = "create-memory";
  const created = await call("remember_agent", {
    title: `[M6] hard delete acceptance ${suffix}`,
    content:
      `M6 hard delete acceptance ${suffix}. ` +
      "This isolated memory verifies immutable source, graph provenance, and cleanup.",
    contextKey,
  });
  createdId = created.item?.id;

  if (!createdId) {
    throw new Error("Acceptance memory was not created.");
  }

  const deadline = Date.now() + timeoutMs;
  let ready;
  let provenance = [];
  phase = "wait-for-indexing";

  while (Date.now() < deadline) {
    const detail = await call("get_asset", { id: createdId });
    ready = detail.item;

    if (ready?.status === "failed") {
      throw new Error("Acceptance memory processing failed.");
    }

    if (
      ready?.status === "ready" &&
      ready.rawR2Key &&
      ready.chunks?.some((chunk) => chunk.vectorId)
    ) {
      provenance = queryD1(
        `SELECT memory_type AS memoryType, memory_id AS memoryId
         FROM provenance WHERE asset_id = ${sqlLiteral(createdId)}`
      );

      if (provenance.length > 0) {
        break;
      }
    }

    await sleep(pollMs);
  }

  if (!ready?.rawR2Key || provenance.length === 0) {
    throw new Error("Acceptance memory did not become fully indexed in time.");
  }

  const assetVectorIds = ready.chunks
    .map((chunk) => chunk.vectorId)
    .filter(Boolean);
  const graphVectorIds = queryD1(
    `SELECT DISTINCT entity.embedding_vector_id AS vectorId
     FROM provenance source
     JOIN entities entity ON source.memory_type = 'entity'
       AND source.memory_id = entity.id
     WHERE source.asset_id = ${sqlLiteral(createdId)}
       AND entity.embedding_vector_id IS NOT NULL`
  )
    .map((row) => row.vectorId)
    .filter(Boolean);

  phase = "soft-delete";
  await call("forget", {
    id: createdId,
    scopeId: "agent",
    contextKey,
  });
  phase = "hard-delete";
  const hardResult = await call("forget", {
    id: createdId,
    scopeId: "agent",
    contextKey,
    mode: "hard",
    confirmId: createdId,
  });
  hardDeleted = true;

  phase = "verify-d1";
  const auditId = hardResult.auditId;
  const [state] = queryD1(
    `SELECT
       (SELECT COUNT(*) FROM assets WHERE id = ${sqlLiteral(createdId)}) AS assetCount,
       status, target_hash AS targetHash, completed_at AS completedAt
     FROM deletion_audits WHERE id = ${sqlLiteral(auditId)}`
  );

  if (
    state?.assetCount !== 0 ||
    state.status !== "completed" ||
    typeof state.targetHash !== "string" ||
    state.targetHash.length !== 64 ||
    !state.completedAt
  ) {
    throw new Error("D1 hard delete or audit verification failed.");
  }

  phase = "verify-l2";
  for (const type of ["statement", "edge", "entity"]) {
    const ids = provenance
      .filter((entry) => entry.memoryType === type)
      .map((entry) => entry.memoryId);

    if (ids.length === 0) {
      continue;
    }

    const table =
      type === "entity"
        ? "entities"
        : type === "statement"
          ? "statements"
          : "edges";
    const [remaining] = queryD1(
      `SELECT COUNT(*) AS count FROM "${table}"
       WHERE id IN (${ids.map(sqlLiteral).join(", ")})`
    );

    if ((remaining?.count ?? 0) !== 0) {
      throw new Error("Exclusive L2 records remained after hard delete.");
    }
  }

  phase = "verify-r2";
  const r2Target = join(temporaryDirectory, "raw-object");
  const r2Read = runWrangler([
    "r2",
    "object",
    "get",
    `${bucket}/${ready.rawR2Key}`,
    "--remote",
    "--file",
    r2Target,
  ]);
  const r2Info = runWrangler(["r2", "bucket", "info", bucket, "--json"]);

  if (r2Read.status === 0 || r2Info.status !== 0) {
    throw new Error("R2 hard delete verification failed.");
  }

  phase = "verify-vectorize";
  if (
    getVectors(assetIndex, assetVectorIds).length > 0 ||
    getVectors(graphIndex, graphVectorIds).length > 0
  ) {
    throw new Error("Vectorize records remained after hard delete.");
  }

  console.log(
    `PASS - M6 hard delete acceptance verified (${hardResult.deletedAssetCount} assets, ` +
      `${hardResult.deletedBlobCount} blobs, ` +
      `${hardResult.deletedAssetVectorCount} chunk vectors, ` +
      `${hardResult.deletedGraphVectorCount} graph vectors, ` +
      `${hardResult.deletedL2RecordCount} L2 records).`
  );
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown acceptance failure.";
  console.error(`FAIL - M6 hard delete acceptance at ${phase}: ${message}`);
  throw error;
} finally {
  if (createdId && !hardDeleted) {
    try {
      await call("forget", {
        id: createdId,
        scopeId: "agent",
        contextKey,
      });
    } catch {
      // 记录可能已经软删除。
    }

    try {
      await call("forget", {
        id: createdId,
        scopeId: "agent",
        contextKey,
        mode: "hard",
        confirmId: createdId,
      });
    } catch {
      // 保留失败审计，交由同一测试上下文重试。
    }
  }

  await transport.close().catch(() => undefined);
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
