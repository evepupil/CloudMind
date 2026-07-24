// M3-A3 生产验收：两个项目都写入 M1/M2，验证 D1 列表与混合检索/L2 图召回隔离。
// 用法：CLOUDMIND_MCP_TOKEN=<token> node scripts/project-isolation-acceptance.mjs

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const baseUrl = (
  process.env.SMOKE_BASE_URL ?? "https://cloudmind.chaosyn.com"
).replace(/\/$/, "");
const token = process.env.CLOUDMIND_MCP_TOKEN;
const readyTimeoutMs = Number(process.env.SMOKE_READY_TIMEOUT_MS ?? 180000);
const pollMs = Number(process.env.SMOKE_POLL_MS ?? 4000);

if (!token) {
  throw new Error("CLOUDMIND_MCP_TOKEN is required.");
}

const suffix = Date.now().toString(36);
const fixtures = [
  {
    contextKey: `project:github:evepupil/M3IsolationA-${suffix}`,
    title: `[M3-A3] Project A ${suffix}`,
    content:
      `Project A roadmap ${suffix}. M1 precedes M2. ` +
      "M1 establishes retrieval and M2 establishes the knowledge graph.",
  },
  {
    contextKey: `project:github:evepupil/M3IsolationB-${suffix}`,
    title: `[M3-A3] Project B ${suffix}`,
    content:
      `Project B roadmap ${suffix}. M1 precedes M2. ` +
      "M1 establishes deployment and M2 establishes release operations.",
  },
];

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const authedFetch = (input, init = {}) => {
  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
};

const client = new Client({
  name: "project-isolation-acceptance",
  version: "0.1.0",
});
const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
  fetch: authedFetch,
});

const structured = (result) => {
  if (!result || typeof result.structuredContent !== "object") {
    throw new Error("MCP tool result missing structuredContent.");
  }

  return result.structuredContent;
};

const call = async (name, args) =>
  structured(await client.callTool({ name, arguments: args }));

const waitReady = async (id) => {
  const deadline = Date.now() + readyTimeoutMs;

  while (Date.now() < deadline) {
    const { item } = await call("get_asset", { id });

    if (
      item?.status === "ready" &&
      item.chunks?.some((chunk) => chunk.vectorId)
    ) {
      return item;
    }
    if (item?.status === "failed") {
      throw new Error(`Memory ${id} failed: ${item.errorMessage ?? "unknown"}`);
    }

    await sleep(pollMs);
  }

  throw new Error(`Memory ${id} did not become ready within timeout.`);
};

const assertExactAsset = (label, result, expectedId, excludedId) => {
  const ids = (result.items ?? []).map((item) =>
    item.kind === "chunk" ? item.chunk?.asset?.id : item.asset?.id
  );

  if (!ids.includes(expectedId) || ids.includes(excludedId)) {
    throw new Error(
      `${label} crossed project boundaries: ${JSON.stringify(ids)}`
    );
  }
};

const waitGraphEvidence = async (fixture, expectedId, excludedId) => {
  const deadline = Date.now() + readyTimeoutMs;

  while (Date.now() < deadline) {
    const result = await call("search_assets", {
      query: `M1 M2 roadmap ${suffix}`,
      recordKinds: ["memory"],
      scopeIds: ["agent"],
      contextKeys: [fixture.contextKey],
      pageSize: 10,
    });
    const group = (result.groupedEvidence ?? []).find(
      (entry) => entry.asset?.id === expectedId
    );
    const crossed = (result.groupedEvidence ?? []).some(
      (entry) => entry.asset?.id === excludedId
    );

    if (crossed) {
      throw new Error(
        `${fixture.contextKey} returned the other project's asset.`
      );
    }
    if (group?.matchedLayers?.includes("statement")) {
      return result;
    }

    await sleep(pollMs);
  }

  throw new Error(
    `${fixture.contextKey} did not produce L2 statement evidence.`
  );
};

const created = [];

try {
  await client.connect(transport);

  for (const fixture of fixtures) {
    const { item } = await call("remember_agent", {
      title: fixture.title,
      content: fixture.content,
      contextKey: fixture.contextKey,
    });
    created.push({ ...fixture, id: item.id });
  }

  const [first, second] = created;
  if (!first || !second) {
    throw new Error("Acceptance fixtures were not created.");
  }

  await Promise.all(created.map((fixture) => waitReady(fixture.id)));

  const [listA, listB] = await Promise.all(
    created.map((fixture) =>
      call("list_assets", {
        recordKinds: ["memory"],
        scopeIds: ["agent"],
        contextKeys: [fixture.contextKey],
        pageSize: 20,
      })
    )
  );
  const listAIds = (listA.items ?? []).map((item) => item.id);
  const listBIds = (listB.items ?? []).map((item) => item.id);

  if (!listAIds.includes(first.id) || listAIds.includes(second.id)) {
    throw new Error("D1 list isolation failed for project A.");
  }
  if (!listBIds.includes(second.id) || listBIds.includes(first.id)) {
    throw new Error("D1 list isolation failed for project B.");
  }

  const [searchA, searchB] = await Promise.all([
    waitGraphEvidence(first, first.id, second.id),
    waitGraphEvidence(second, second.id, first.id),
  ]);
  assertExactAsset("project A hybrid search", searchA, first.id, second.id);
  assertExactAsset("project B hybrid search", searchB, second.id, first.id);

  console.log(
    "PASS - M3-A3 project isolation verified through D1 list, " +
      "FTS/Vectorize hybrid retrieval and L2 statement evidence."
  );
} finally {
  for (const fixture of created) {
    await call("forget", {
      id: fixture.id,
      scopeId: "agent",
      contextKey: fixture.contextKey,
    }).catch(() => undefined);
  }
  await client.close().catch(() => undefined);
}
