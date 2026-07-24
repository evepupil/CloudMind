// M3-A1 只读验收：检查真实 MCP schema、三维过滤回显和记忆工具默认策略。
// 用法：CLOUDMIND_MCP_TOKEN=<token> node scripts/record-filter-acceptance.mjs

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const baseUrl = (
  process.env.SMOKE_BASE_URL ?? "https://cloudmind.chaosyn.com"
).replace(/\/$/, "");
const token = process.env.CLOUDMIND_MCP_TOKEN;

if (!token) {
  throw new Error("CLOUDMIND_MCP_TOKEN is required.");
}

const authedFetch = (input, init = {}) => {
  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
};

const client = new Client({
  name: "record-filter-acceptance",
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

const expectFilters = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${name} appliedRecordFilters mismatch: ${JSON.stringify(actual)}`
    );
  }
};

const run = async () => {
  await client.connect(transport);
  const tools = (await client.listTools()).tools;
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));

  for (const name of [
    "list_assets",
    "search_assets",
    "recall",
    "recall_agent",
    "ask_library",
  ]) {
    const properties = byName[name]?.inputSchema?.properties ?? {};

    for (const field of ["recordKinds", "scopeIds", "contextKeys"]) {
      if (properties[field]?.type !== "array") {
        throw new Error(`${name}.${field} is not exposed as an array.`);
      }
    }
  }

  const explicitFilters = {
    recordKinds: ["library"],
    scopeIds: ["personal"],
    contextKeys: ["global"],
  };
  const listResult = structured(
    await client.callTool({
      name: "list_assets",
      arguments: { ...explicitFilters, pageSize: 1 },
    })
  );
  expectFilters(
    "list_assets",
    listResult.appliedRecordFilters,
    explicitFilters
  );

  const searchResult = structured(
    await client.callTool({
      name: "search_assets",
      arguments: {
        query: "CloudMind",
        ...explicitFilters,
        pageSize: 1,
      },
    })
  );
  expectFilters(
    "search_assets",
    searchResult.appliedRecordFilters,
    explicitFilters
  );

  const recallResult = structured(
    await client.callTool({
      name: "recall",
      arguments: { queries: ["CloudMind"] },
    })
  );
  expectFilters("recall", recallResult.appliedRecordFilters, {
    recordKinds: ["memory"],
    scopeIds: ["personal"],
  });

  const agentResult = structured(
    await client.callTool({
      name: "recall_agent",
      arguments: { queries: ["CloudMind"] },
    })
  );
  expectFilters("recall_agent", agentResult.appliedRecordFilters, {
    recordKinds: ["memory"],
    scopeIds: ["personal", "agent"],
    contextKeys: ["global"],
  });

  console.log(
    `PASS - M3-A1 MCP filters verified (${tools.length} tools, ` +
      `${listResult.pagination?.total ?? 0} visible library records).`
  );
  await client.close();
};

run().catch(async (error) => {
  console.error(
    `ACCEPTANCE ERROR: ${error instanceof Error ? error.message : String(error)}`
  );
  await client.close().catch(() => undefined);
  process.exitCode = 1;
});
