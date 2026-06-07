// CloudMind A3 验收脚本：对真实实例端到端验证「绝对 pin」可见性门控 + 中文分类安全修复。
//
// 三发证明：
//   A 中文财务记忆「不 pin」  → 期望 summary_only（证明中文 classify 修复：此前漏判 allow）
//   B 普通内容「pin=deny」     → 期望 deny，且 recall 召不回（证明 pin 绝对覆盖 allow→deny）
//   C 中文财务记忆「pin=allow」→ 期望 allow（证明 pin 绝对覆盖 summary_only→allow）
//
// 用法：
//   SMOKE_BASE_URL=https://cloudmind.chaosyn.com \
//   SMOKE_USERNAME=admin SMOKE_PASSWORD=Passw0rdd. \
//   node scripts/visibility-pin-acceptance.mjs
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
const TAG = "[Pin验收]";

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
  const form = new URLSearchParams({
    name: `visibility-pin-acceptance ${TAG}`,
  });
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
    name: "visibility-pin-acceptance",
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

// remember：可选 visibility pin（A3 新增）。
const remember = async (client, content, title, visibility) => {
  const result = await client.callTool({
    name: "remember",
    arguments: visibility ? { content, title, visibility } : { content, title },
  });
  const { item } = structured(result);

  return item;
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

const recall = async (client, queries) => {
  const result = await client.callTool({
    name: "recall",
    arguments: { queries },
  });

  return structured(result);
};

const FINANCE_CONTENT =
  "用户年收入约 50 万人民币，名下有一套按揭中的房产，另有约 80 万现金储蓄。";
// B 用「无敏感词」的普通工程内容：classify 本会判 allow，靠 pin=deny 才门控——证明 pin 的绝对性。
const DENY_CONTENT =
  "项目代号 zephyrquokka 的官网采用 Astro 框架与 Tailwind 构建，部署在 Cloudflare Pages。";

const run = async () => {
  log(`CloudMind A3 visibility-pin acceptance against ${BASE_URL}`);

  await login();
  log("authenticated");

  const token = await createToken();
  log(`created MCP token ${token.slice(0, 12)}...${token.slice(-6)}`);

  const client = await connectMcp(token);
  const toolNames = (await client.listTools()).tools.map((tool) => tool.name);

  if (!toolNames.includes("remember") || !toolNames.includes("recall")) {
    throw new Error("remember/recall tools are not exposed by the server.");
  }

  // 三发写入。
  const a = await remember(
    client,
    FINANCE_CONTENT,
    `${TAG}A 财务-不pin`,
    undefined
  );
  const b = await remember(client, DENY_CONTENT, `${TAG}B deny-pin`, "deny");
  const c = await remember(
    client,
    FINANCE_CONTENT,
    `${TAG}C 财务-pin-allow`,
    "allow"
  );
  log(`remember A(no pin)=${a.id}  B(deny)=${b.id}  C(allow)=${c.id}`);

  const readyA = await waitReady(a.id, "A");
  const readyB = await waitReady(b.id, "B");
  const readyC = await waitReady(c.id, "C");

  log("");
  log(
    `A 中文财务·不 pin    → aiVisibility=${readyA.aiVisibility} (期望 summary_only) · domain=${readyA.domain}`
  );
  log(
    `B 普通内容·pin=deny  → aiVisibility=${readyB.aiVisibility} (期望 deny) · domain=${readyB.domain}`
  );
  log(
    `C 中文财务·pin=allow → aiVisibility=${readyC.aiVisibility} (期望 allow) · domain=${readyC.domain}`
  );

  // 验证 deny 资产完全不进检索：recall 它的独特内容，结果里不应出现。
  const denyRecall = await recall(client, [
    "zephyrquokka Astro 官网 框架 部署",
  ]);
  const denyLeaked = denyRecall.memories.some(
    (memory) =>
      memory.title.includes(`${TAG}B`) || /zephyrquokka/i.test(memory.snippet)
  );

  log("");
  log(
    `recall(zephyrquokka…) total=${denyRecall.memories.length} · deny 是否泄漏=${denyLeaked}`
  );

  const aOk = readyA.aiVisibility === "summary_only";
  const bOk = readyB.aiVisibility === "deny";
  const cOk = readyC.aiVisibility === "allow";
  const denyHidden = !denyLeaked;
  const ok = aOk && bOk && cOk && denyHidden;

  log("");
  log(`A 中文 classify 修复（→summary_only）: ${aOk ? "PASS" : "FAIL"}`);
  log(`B 绝对 pin deny（allow→deny）       : ${bOk ? "PASS" : "FAIL"}`);
  log(`C 绝对 pin allow（summary_only→allow）: ${cOk ? "PASS" : "FAIL"}`);
  log(`deny 不进检索                        : ${denyHidden ? "PASS" : "FAIL"}`);
  log("");
  log(`${ok ? "PASS" : "FAIL"} — A3 visibility gating verified in production`);
  log(
    `seeded 3 memories (titles prefixed "${TAG}"); token "visibility-pin-acceptance ${TAG}". Clean up when done.`
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
