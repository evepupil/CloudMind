// CloudMind recall-schema 验收脚本：对真实实例验证「MCP 工具对外 JSON schema 不再退化为空 properties」。
//
// 背景 bug：recall 的 inputSchema 曾用 .transform()（search_assets_for_context 用 .and()），
// 被 MCP SDK 的 normalizeObjectSchema() 归一化为 undefined → ListTools 暴露空 properties{}。
// AI 客户端读不到 queries 是数组 → 序列化错 → 后端报 "expected array" → 反复瞎试。
//
// 本脚本从真实 MCP 客户端视角拉取 ListTools，断言：
//   1. recall.inputSchema.properties.queries 存在、type=array、maxItems=5、required 含 queries。
//   2. search_assets / search_assets_for_context / list_assets 的 properties 非空。
//   3. 功能回归：remember 一条 → recall(queries=[...]) 能正常返回（管线未被改坏）。
//
// 用法：
//   SMOKE_BASE_URL=https://cloudmind.chaosyn.com \
//   SMOKE_USERNAME=admin SMOKE_PASSWORD=Passw0rdd. \
//   node scripts/recall-schema-acceptance.mjs
//
// 退出码：全通过 0，否则 1。

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const BASE_URL = (
  process.env.SMOKE_BASE_URL ?? "https://cloudmind.chaosyn.com"
).replace(/\/$/, "");
const USERNAME = process.env.SMOKE_USERNAME ?? "admin";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "admin";
const READY_TIMEOUT_MS = Number(process.env.SMOKE_READY_TIMEOUT_MS ?? 180000);
const POLL_MS = Number(process.env.SMOKE_POLL_MS ?? 3000);
const TAG = "[Schema验收]";

const jar = new Map();

const applySetCookies = (response) => {
  const list =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];

  for (const raw of list) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");

    if (eq > 0) {
      jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
};

const cookieHeader = () =>
  [...jar].map(([key, value]) => `${key}=${value}`).join("; ");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message) => console.log(message);

const login = async () => {
  const form = new URLSearchParams({
    username: USERNAME,
    password: PASSWORD,
    next: "/",
  });
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
    redirect: "manual",
  });

  applySetCookies(response);
  const location = response.headers.get("location") ?? "";

  if (location.includes("error=")) {
    throw new Error(`Login failed: ${decodeURIComponent(location)}`);
  }
};

const scrapeTokens = async () => {
  const response = await fetch(`${BASE_URL}/mcp-tokens`, {
    headers: { cookie: cookieHeader() },
  });
  const html = await response.text();

  return new Set(html.match(/cm_[0-9a-f]{64}/g) ?? []);
};

const createToken = async () => {
  const before = await scrapeTokens();
  const form = new URLSearchParams({ name: `recall-schema-acceptance ${TAG}` });
  const response = await fetch(`${BASE_URL}/mcp-tokens/actions/create`, {
    method: "POST",
    headers: {
      cookie: cookieHeader(),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form,
    redirect: "manual",
  });

  if (response.status >= 400) {
    throw new Error(`create token failed: ${response.status}`);
  }

  const after = await scrapeTokens();
  const fresh = [...after].filter((value) => !before.has(value));
  const token = fresh[0] ?? [...after][0];

  if (!token) {
    throw new Error("Could not obtain an MCP token value from the page.");
  }

  return token;
};

const connectMcp = async (token) => {
  const authedFetch = (input, init = {}) => {
    const headers = new Headers(init.headers ?? {});
    headers.set("Authorization", `Bearer ${token}`);

    return fetch(input, { ...init, headers });
  };
  const client = new Client({
    name: "recall-schema-acceptance",
    version: "0.1.0",
  });
  const transport = new StreamableHTTPClientTransport(
    new URL(`${BASE_URL}/mcp`),
    { fetch: authedFetch }
  );

  await client.connect(transport);

  return client;
};

const structured = (result) => {
  if (!result || typeof result.structuredContent !== "object") {
    throw new Error("MCP tool result missing structuredContent.");
  }

  return result.structuredContent;
};

const waitReady = async (id, title) => {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = await fetch(`${BASE_URL}/api/assets/${id}`, {
      headers: { cookie: cookieHeader() },
    });

    if (response.ok) {
      const { item } = await response.json();

      if (item.status === "ready") {
        return item;
      }

      if (item.status === "failed") {
        throw new Error(`"${title}" processing failed: ${item.errorMessage}`);
      }
    }

    await sleep(POLL_MS);
  }

  throw new Error(`"${title}" did not become ready within timeout`);
};

const run = async () => {
  log(`CloudMind recall-schema acceptance against ${BASE_URL}`);

  await login();
  log("authenticated");

  const token = await createToken();
  log(`created MCP token ${token.slice(0, 12)}...${token.slice(-6)}`);

  const client = await connectMcp(token);
  const tools = (await client.listTools()).tools;
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));

  // 1) recall 的对外 schema 必须保留 properties，且 queries 是数组。
  const recallProps = byName.recall?.inputSchema?.properties ?? {};
  const queries = recallProps.queries ?? {};
  const recallQueriesOk = queries.type === "array" && queries.maxItems === 5;
  const recallRequiredOk = (
    byName.recall?.inputSchema?.required ?? []
  ).includes("queries");

  // 2) 同根问题的另外三个工具也必须非空 properties。
  const otherTools = [
    "search_assets",
    "search_assets_for_context",
    "list_assets",
  ];
  const otherPropsCounts = otherTools.map((name) => ({
    name,
    count: Object.keys(byName[name]?.inputSchema?.properties ?? {}).length,
  }));
  const othersOk = otherPropsCounts.every((entry) => entry.count > 0);

  // 3) 功能回归：remember 一条 → recall(queries=[...]) 正常返回。
  const remembered = structured(
    await client.callTool({
      name: "remember",
      arguments: {
        content: "用户正在验证 recall 工具的入参 schema 是否已修复。",
        title: `${TAG}probe`,
      },
    })
  ).item;
  log(`remember -> ${remembered.id}`);
  await waitReady(remembered.id, `${TAG}probe`);

  const recallResult = structured(
    await client.callTool({
      name: "recall",
      arguments: { queries: ["recall 入参 schema 验证"] },
    })
  );
  const recallReturned = Array.isArray(recallResult.memories);

  log("");
  log(
    `1. recall.queries 是数组(type=array,maxItems=5): ${recallQueriesOk ? "PASS" : "FAIL"} (type=${queries.type}, maxItems=${queries.maxItems})`
  );
  log(`   recall.required 含 "queries": ${recallRequiredOk ? "PASS" : "FAIL"}`);
  log(
    `2. search/list 三工具 properties 非空: ${othersOk ? "PASS" : "FAIL"} (${otherPropsCounts
      .map((entry) => `${entry.name}=${entry.count}`)
      .join(", ")})`
  );
  log(
    `3. 功能回归 recall(queries=[...]) 正常返回: ${recallReturned ? "PASS" : "FAIL"} (memories=${recallResult.memories?.length})`
  );

  const ok = recallQueriesOk && recallRequiredOk && othersOk && recallReturned;

  log("");
  log(`${ok ? "PASS" : "FAIL"} — recall MCP schema fix verified in production`);
  log(
    `seeded 1 probe memory (title "${TAG}probe"); token "recall-schema-acceptance ${TAG}". Clean up when done.`
  );

  if (!ok) {
    process.exitCode = 1;
  }

  await client.close();
};

run().catch((error) => {
  console.log(
    `ACCEPTANCE ERROR: ${error instanceof Error ? error.stack : error}`
  );
  process.exitCode = 1;
});
