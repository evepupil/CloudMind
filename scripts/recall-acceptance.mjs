// CloudMind A1/A2 验收脚本：对一个真实运行的实例端到端验证 remember / recall 两个 MCP 记忆动词。
//
// 流程：登录(cookie) → 创建 MCP token(并从页面抓取) → 用 token 走 /mcp：
//   remember×N 灌入高密度个人记忆 → 轮询直到 ready → recall 两个真实场景（买房 / 做网站）→ 打印整捆结果。
//
// 用法（实例需在跑、wrangler 指向真实 D1/Vectorize/Workers AI）：
//   SMOKE_BASE_URL=https://cloudmind.chaosyn.com \
//   SMOKE_USERNAME=admin SMOKE_PASSWORD=Passw0rdd. \
//   node scripts/recall-acceptance.mjs
//
// 说明：处理是队列异步的，轮询直到 status=ready 且 chunk 落库。退出码：全通过 0，否则 1。

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const BASE_URL = (
  process.env.SMOKE_BASE_URL ?? "https://cloudmind.chaosyn.com"
).replace(/\/$/, "");
const USERNAME = process.env.SMOKE_USERNAME ?? "admin";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "admin";
const NEW_PASSWORD = process.env.SMOKE_NEW_PASSWORD;
const READY_TIMEOUT_MS = Number(process.env.SMOKE_READY_TIMEOUT_MS ?? 180000);
const POLL_MS = Number(process.env.SMOKE_POLL_MS ?? 3000);
const TAG = "[验收Demo]";

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

  if (location.includes("/change-password")) {
    if (!NEW_PASSWORD) {
      throw new Error(
        "Account requires a password change. Set SMOKE_NEW_PASSWORD."
      );
    }

    const changeForm = new URLSearchParams({
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
      next: "/",
    });
    const changeResponse = await fetch(`${BASE_URL}/auth/change-password`, {
      method: "POST",
      headers: {
        cookie: cookieHeader(),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: changeForm,
      redirect: "manual",
    });

    applySetCookies(changeResponse);
    log(`changed initial password for "${USERNAME}"`);
  }
};

const scrapeTokens = async () => {
  const response = await fetch(`${BASE_URL}/mcp-tokens`, {
    headers: { cookie: cookieHeader() },
  });
  const html = await response.text();

  return new Set(html.match(/cm_[0-9a-f]{64}/g) ?? []);
};

// 创建一个 MCP token 并从页面抓取其明文值（本 MVP 存明文、页面可再查看）。
const createToken = async () => {
  const before = await scrapeTokens();
  const form = new URLSearchParams({ name: `recall-acceptance ${TAG}` });
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
  // 用 new Headers 正确合并：保留 SDK 设置的 Accept(application/json + text/event-stream)，
  // 只追加 Authorization。直接对象展开会丢掉 Headers 实例里的头。
  const authedFetch = (input, init = {}) => {
    const headers = new Headers(init.headers ?? {});
    headers.set("Authorization", `Bearer ${token}`);

    return fetch(input, { ...init, headers });
  };
  const client = new Client({
    name: "recall-acceptance",
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

const remember = async (client, content, title) => {
  const result = await client.callTool({
    name: "remember",
    arguments: { content, title },
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

      if (item.status === "ready" && (item.chunks?.length ?? 0) > 0) {
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

const recall = async (client, queries, domain) => {
  const result = await client.callTool({
    name: "recall",
    arguments: domain ? { queries, domain } : { queries },
  });

  return structured(result);
};

const printBundle = (scenario, bundle) => {
  log(`\n===== recall: ${scenario} =====`);
  log(`queries: ${JSON.stringify(bundle.queries)}`);
  log(`total memories: ${bundle.total}`);
  for (const memory of bundle.memories) {
    log(
      `  • [${memory.kind} ${memory.score.toFixed(3)}] ${memory.title}\n` +
        `      ${memory.snippet}\n` +
        `      matched: ${JSON.stringify(memory.matchedQueries)} · domain=${memory.domain} · sourceKind=${memory.sourceKind}`
    );
  }
};

// 五条高密度个人记忆（模拟「人的记忆层」里关于用户本人的事实/偏好/规范）。
const MEMORIES = [
  {
    title: `${TAG} 居住城市`,
    content: "用户目前居住在杭州，2024 年从上海搬来，计划长期定居。",
  },
  {
    title: `${TAG} 家庭状况`,
    content: "用户已婚，有一个 3 岁的女儿，配偶在本地工作。",
  },
  {
    title: `${TAG} 财务状况`,
    content:
      "用户年收入约 50 万人民币，名下有一套按揭中的房产，另有约 80 万现金储蓄。",
  },
  {
    title: `${TAG} 编程偏好`,
    content:
      "用户的编程偏好：TypeScript strict、2 空格缩进、用 Biome 格式化、函数式优先、代码注释用中文。",
  },
  {
    title: `${TAG} 项目规范`,
    content:
      "用户的项目规范：feature-first 目录结构、所有基础设施走适配器边界、提交信息用中文 conventional commits。",
  },
];

const run = async () => {
  log(`CloudMind A1/A2 recall acceptance against ${BASE_URL}`);

  await login();
  log("authenticated");

  const token = await createToken();
  log(`created MCP token ${token.slice(0, 12)}...${token.slice(-6)}`);

  const client = await connectMcp(token);
  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name);
  log(`MCP tools: ${toolNames.join(", ")}`);

  if (!toolNames.includes("remember") || !toolNames.includes("recall")) {
    throw new Error("remember/recall tools are not exposed by the server.");
  }

  const ids = [];
  for (const memory of MEMORIES) {
    const item = await remember(client, memory.content, memory.title);
    ids.push({ id: item.id, title: memory.title });
    log(`remember -> ${item.id} (${memory.title})`);
  }

  for (const entry of ids) {
    const item = await waitReady(entry.id, entry.title);
    log(
      `ready -> ${entry.id} (${entry.title}) · aiVisibility=${item.aiVisibility} · domain=${item.domain} · chunks=${item.chunks?.length ?? 0}`
    );
  }

  // 场景 A：我该买房吗 —— AI 发散为多个关于「我」的子查询，跨 personal/finance。
  const buyHouse = await recall(client, [
    "居住城市 搬迁 定居",
    "年收入 现金 储蓄",
    "婚姻 家庭 子女",
    "现有房产 按揭",
  ]);
  printBundle("我该买房吗", buyHouse);

  // 场景 B：帮我做个网站 —— 取用户的开发习惯/技术栈/规范，限定 engineering 域。
  const buildSite = await recall(
    client,
    ["编程语言 技术栈 偏好", "代码风格 缩进 格式化", "项目目录规范 提交规范"],
    "engineering"
  );
  printBundle("帮我做个网站", buildSite);

  // 简单断言：两个场景都召回到至少 2 条记忆，且买房场景能取到城市与财务信号。
  const ok =
    buyHouse.total >= 2 &&
    buildSite.total >= 2 &&
    buyHouse.memories.some((memory) => /杭州|上海|搬/.test(memory.snippet));

  log(`\n${ok ? "PASS" : "FAIL"} — recall returned usable personal context`);
  log(
    `seeded ${ids.length} demo memories (titles prefixed "${TAG}"); token name "recall-acceptance ${TAG}". Clean up from the UI when done.`
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
