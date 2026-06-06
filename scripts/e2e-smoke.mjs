// CloudMind 端到端冒烟脚本：对一个真实运行的实例（`wrangler dev --remote` 或已部署 URL）
// 驱动 ingest → 异步处理 → search → delete 全链路，校验 P1 检索改造（结构切块/原生过滤/中文语义召回/删除清向量）。
//
// 用法（需要实例已在跑、且 wrangler 已登录指向真实 D1/Vectorize/Workers AI）：
//   SMOKE_BASE_URL=http://127.0.0.1:8787 \
//   SMOKE_USERNAME=admin SMOKE_PASSWORD=admin SMOKE_NEW_PASSWORD=cloudmind-smoke \
//   node scripts/e2e-smoke.mjs
//
// 说明：
//   - 首次部署默认账号 admin/admin 且 mustChangePassword=true；提供 SMOKE_NEW_PASSWORD 让脚本自动改密。
//   - 处理是队列异步的（每条资产约 7 次 LLM 调用 + 嵌入），轮询直到 status=ready。
//   - 退出码：全部通过 0，否则 1。

const BASE_URL = (
  process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:8787"
).replace(/\/$/, "");
const USERNAME = process.env.SMOKE_USERNAME ?? "admin";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "admin";
const NEW_PASSWORD = process.env.SMOKE_NEW_PASSWORD;
const READY_TIMEOUT_MS = Number(process.env.SMOKE_READY_TIMEOUT_MS ?? 180000);
const POLL_MS = Number(process.env.SMOKE_POLL_MS ?? 3000);
const TAG = `smoke-${Date.now()}`;

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

const checks = [];

const check = (name, ok, detail = "") => {
  checks.push({ name, ok });
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`
  );
};

const log = (message) => {
  console.log(message);
};

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
        "Account requires a password change. Set SMOKE_NEW_PASSWORD to let the script change it."
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

const api = async (path, options = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      cookie: cookieHeader(),
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    redirect: "manual",
  });

  return response;
};

const ingestText = async (title, content) => {
  const response = await api("/api/ingest/text", {
    method: "POST",
    body: JSON.stringify({ title, content }),
  });

  if (response.status !== 201) {
    throw new Error(
      `ingest "${title}" failed: ${response.status} ${await response.text()}`
    );
  }

  const data = await response.json();
  return data.item.id;
};

const waitReady = async (id, title) => {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = await api(`/api/assets/${id}`);

    if (response.ok) {
      const { item } = await response.json();

      // ready 后 chunk 可能比 status 晚一拍写入（finalize 先置 ready 再 replaceAssetChunks），
      // 这里等到 ready 且 chunk 已落库再返回，避免竞态误报 0 chunk。
      if (item.status === "ready" && (item.chunks?.length ?? 0) > 0) {
        return item;
      }

      if (item.status === "failed") {
        throw new Error(
          `asset "${title}" processing failed: ${item.errorMessage}`
        );
      }
    }

    await sleep(POLL_MS);
  }

  throw new Error(`asset "${title}" did not become ready within timeout`);
};

const search = async (query, filters = {}) => {
  const response = await api("/api/search", {
    method: "POST",
    body: JSON.stringify({ query, pageSize: 20, ...filters }),
  });

  if (!response.ok) {
    throw new Error(`search "${query}" failed: ${response.status}`);
  }

  const result = await response.json();
  return (result.groupedEvidence ?? []).map((group) => group.asset.id);
};

const deleteAsset = async (id) => {
  const response = await api(`/api/assets/${id}`, { method: "DELETE" });

  if (!response.ok) {
    throw new Error(`delete ${id} failed: ${response.status}`);
  }
};

const run = async () => {
  log(`CloudMind E2E smoke against ${BASE_URL} (tag=${TAG})`);

  await login();
  log("authenticated");

  // 三篇可区分的样本：英文 D1、英文 reranker、中文向量检索。
  const docs = [
    {
      key: "d1",
      title: `${TAG} D1`,
      content:
        "Cloudflare D1 is a serverless SQLite database that runs at the edge. " +
        "It is the structured metadata store used by this knowledge base.",
      query: "serverless sqlite database at the edge",
    },
    {
      key: "rerank",
      title: `${TAG} Reranker`,
      content:
        "A cross-encoder reranker scores query-document relevance and reorders " +
        "the top candidates returned by hybrid retrieval before grouping.",
      query: "cross encoder reranker relevance reordering",
    },
    {
      key: "zh",
      title: `${TAG} 向量检索`,
      content:
        "向量检索通过嵌入模型把文本变成向量，使用余弦相似度做语义搜索和召回，" +
        "支持中文和英文的多语言语义匹配。",
      query: "向量检索 余弦相似度 语义搜索",
    },
  ];

  const ids = {};

  for (const doc of docs) {
    ids[doc.key] = await ingestText(doc.title, doc.content);
    log(`ingested ${doc.key} -> ${ids[doc.key]}`);
  }

  for (const doc of docs) {
    const item = await waitReady(ids[doc.key], doc.title);
    const chunk = item.chunks?.[0];
    check(
      `[T1/T3] ${doc.key}: processed to ready with chunks`,
      Array.isArray(item.chunks) && item.chunks.length > 0,
      `chunks=${item.chunks?.length ?? 0}`
    );
    check(
      `[T3] ${doc.key}: chunk carries embedding lineage (model + hash)`,
      Boolean(chunk?.embeddingModel) && Boolean(chunk?.contentHash),
      chunk ? `model=${chunk.embeddingModel}` : "no chunk"
    );
  }

  // 语义召回（含中文）：每篇用自己的 query 应能召回自己。
  for (const doc of docs) {
    const hits = await search(doc.query);
    check(
      `[T2/T4/T6] ${doc.key}: semantic search recalls the doc`,
      hits.includes(ids[doc.key]),
      `top=${hits.slice(0, 3).join(",")}`
    );
  }

  // 原生 metadata 过滤（T4）：按 type=note 过滤仍应召回（样本均为 note）。
  const filteredHits = await search(docs[0].query, { type: "note" });
  check(
    "[T4] native metadata filter (type=note) returns results",
    filteredHits.includes(ids.d1),
    `count=${filteredHits.length}`
  );

  // 删除清向量（T8a）：删掉 D1 篇后，再搜应不再召回它（无 ghost 向量）。
  await deleteAsset(ids.d1);
  log(`deleted ${ids.d1}`);
  // 给删除/向量清理一点传播时间。
  await sleep(POLL_MS);
  const afterDelete = await search(docs[0].query);
  check(
    "[T8a] deleted asset no longer surfaces in search (no ghost vectors)",
    !afterDelete.includes(ids.d1),
    `top=${afterDelete.slice(0, 3).join(",")}`
  );

  const failed = checks.filter((entry) => !entry.ok);
  log(`\n${checks.length - failed.length}/${checks.length} checks passed`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.log(`SMOKE ERROR: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
