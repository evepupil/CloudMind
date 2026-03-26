# CloudMind

[EN](./README.md) | [ZH-CN](./README.zh-CN.md)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/evepupil/CloudMind)

CloudMind 是一个开源、Cloudflare Native、serverless-first 的 AI
时代私有 AI 记忆层。

它被设计为一个 BYOC（Bring Your Own Cloud）项目：

- 部署到你自己的 Cloudflare 账号
- 原始资产、派生内容与索引都由你自己掌控
- 默认保持私有，不依赖托管式 SaaS 运营方
- 受益于 Cloudflare 原生部署、可用性与低运维门槛
- 默认优先使用 Cloudflare 原生基础设施
- 从一开始保留后续迁移所需的抽象边界

## 应用场景

CloudMind 不只是传统意义上的个人知识库，它更适合这样的场景：

- 作为个人 AI memory layer，支持搜索、引用与复用
- 将保存的 URL、笔记、PDF、AI 对话转成可持续利用的结构化上下文
- 为 LLM 应用提供基于用户自有数据的 grounding，而不是依赖 SaaS 锁定的数据层
- 通过 Web UI、REST API、浏览器插件、MCP tools 以及未来更多接口，
  暴露一个私有记忆与上下文系统
- 作为 retrieval、agent memory 与 context engineering 工作流的可迁移基础设施

## 概览

CloudMind 将 URL、笔记、PDF、浏览器采集数据以及 AI 产生的内容，
统一采集到一个记忆层中，并通过处理流水线生成：

- 规范化内容
- 摘要
- chunks
- embeddings
- 可搜索、可问答的记忆资产

当前实现是一个单体 HonoX 全栈应用，包含：

- Web UI
- REST API
- 远程 MCP Server
- 基于队列驱动的 ingest workflows

## 技术栈

| 层级 | 选择 |
| --- | --- |
| 全栈框架 | HonoX + Hono |
| 语言 | TypeScript |
| 校验 | Zod |
| 数据库 | Cloudflare D1 |
| ORM | Drizzle ORM |
| Blob 存储 | Cloudflare R2 |
| 向量索引 | Cloudflare Vectorize |
| 异步处理 | Cloudflare Queues |
| AI Provider | Cloudflare Workers AI |
| 测试 | Vitest |
| Lint / Format | Biome |

## 架构

CloudMind 将业务逻辑与基础设施细节分离。核心服务层依赖端口抽象编写，因此当前的 Cloudflare 实现后续可以被替换。

关键边界包括：

- `AssetRepository`
- `BlobStore`
- `VectorStore`
- `JobQueue`
- `AIProvider`
- `WorkflowRepository`

当前基础设施映射如下：

| Port | 默认实现 |
| --- | --- |
| `AssetRepository` | D1 + Drizzle |
| `WorkflowRepository` | D1 + Drizzle |
| `BlobStore` | R2 |
| `VectorStore` | Vectorize |
| `JobQueue` | Cloudflare Queues |
| `AIProvider` | Workers AI |

这种设计让应用可以优先走 Cloudflare 原生 MVP 路线，同时保留未来迁移到 PostgreSQL、pgvector、S3-compatible storage 或其他模型提供方的空间。

## 处理流水线

Ingest 系统基于 workflow 驱动。不同类型的资产会进入对应的处理流程：

- `note_ingest_v1`
- `url_ingest_v1`
- `pdf_ingest_v1`

典型流程如下：

1. 创建资产元数据
2. 持久化原始输入
3. 创建 workflow run
4. 规范化并持久化清洗后的内容
5. 生成摘要
6. 切分 chunks
7. 生成 embeddings
8. 写入向量与 chunk 元数据
9. 完成资产状态收尾

队列消费入口在 [`app/server.ts`](/G:/my_project/CloudMind/app/server.ts)，workflow 分发注册在 [`src/features/workflows/server/registry.ts`](/G:/my_project/CloudMind/src/features/workflows/server/registry.ts)。

## 检索模型

搜索与问答使用混合检索策略：

- 基于 Vectorize 的 chunk 级语义召回
- 基于 D1 的 summary 级兜底匹配
- 面向来源感知的问答生成

这带来的效果是：

- 当 chunk 向量存在时，可以召回更精确的局部内容
- 对仅有摘要的资产可以优雅降级
- 问答结果可以附带来源引用

## Web 界面

| 路由 | 用途 |
| --- | --- |
| `/` | 首页 |
| `/capture` | 采集入口页 |
| `/assets` | 资产列表 |
| `/assets/:id` | 资产详情 |
| `/search` | 语义检索界面 |
| `/ask` | 基于记忆层的问答界面 |

## API 接口

### Ingest

- `POST /api/ingest/text`
- `POST /api/ingest/url`
- `POST /api/ingest/file`
- `POST /api/assets/:id/process`
- `POST /api/assets/backfill/chunks`

### Assets

- `GET /api/assets`
- `GET /api/assets/:id`
- `PATCH /api/assets/:id`
- `DELETE /api/assets/:id`
- `GET /api/assets/:id/jobs`
- `GET /api/assets/:id/workflows`

### Workflows

- `GET /api/workflows/:id`

### Search / Chat / Health

- `POST /api/search`
- `POST /api/chat`
- `GET /api/health`

## MCP Server

CloudMind 通过无状态 HTTP 暴露远程 MCP Server，入口为：

- `POST /mcp`

当前可用工具：

- `save_asset`
- `search_assets`
- `get_asset`
- `ask_library`

工具语义如下：

- `save_asset`：把文本笔记或 URL 写入记忆层
- `search_assets`：执行语义检索并返回命中的 chunks 或 summary 结果
- `get_asset`：按 ID 拉取资产详情
- `ask_library`：基于记忆层证据回答问题

`GET /mcp` 与 `DELETE /mcp` 会被明确拒绝，并返回 `405 Method not allowed`。

相关实现位于 [`src/features/mcp/server/service.ts`](/G:/my_project/CloudMind/src/features/mcp/server/service.ts)，路由定义位于 [`src/features/mcp/server/routes.ts`](/G:/my_project/CloudMind/src/features/mcp/server/routes.ts)。

## 请求示例

创建一个文本资产：

```bash
curl -X POST http://localhost:5173/api/ingest/text \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cloudflare Queues notes",
    "content": "Queues drive async workflow execution in CloudMind."
  }'
```

执行语义搜索：

```bash
curl -X POST http://localhost:5173/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "queue-driven ingestion",
    "page": 1,
    "pageSize": 10
  }'
```

向记忆层提问：

```bash
curl -X POST http://localhost:5173/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How does CloudMind process ingested content?",
    "topK": 5
  }'
```

## 项目结构

```text
app/
  routes/                         HonoX 页面路由
  server.ts                       应用入口与队列消费入口
src/
  core/                           领域端口与核心契约
  env.ts                          Cloudflare 绑定类型
  features/
    assets/                       资产查询与管理
    chat/                         基于证据的问答
    ingest/                       采集入口与编排逻辑
    mcp/                          远程 MCP Server
    search/                       语义检索
    workflows/                    workflow 运行时与定义
  platform/
    ai/                           Workers AI 适配层
    blob/                         R2 适配层
    db/                           D1 仓储与 schema
    queue/                        Queue 适配层
    vector/                       Vectorize 适配层
drizzle/                          D1 migrations
tests/unit/                       Vitest 单元测试
```

## 本地开发

安装依赖并启动应用：

```bash
npm install
npm run dev
```

常用脚本：

```bash
npm run build
npm run worker:dev
npm run worker:deploy
npm run db:migrate:remote
npm run deploy
npm run deploy:bootstrap
npm run deploy:one-click
npm run typecheck
npm run lint
npm run format
npm run test
```


## One-Click Deploy (New Users)

### Option A: GitHub button -> Cloudflare Dashboard

Use the button at the top of this README, or open:

- https://deploy.workers.cloudflare.com/?url=https://github.com/evepupil/CloudMind

Cloudflare will guide repo connection, resource provisioning, and deploy.

### Option B: Local one-command bootstrap + deploy

```bash
npm install
npm run deploy:one-click -- --prefix my-cloudmind
```

This command will:

- create D1 / R2 / Vectorize / Queue resources
- write bindings to `wrangler.jsonc`
- apply D1 migrations from `drizzle/`
- run `npm run deploy`

Bootstrap only:

```bash
npm run deploy:bootstrap -- --prefix my-cloudmind
```

### Wrangler template note

`wrangler.jsonc` is a template baseline for new users.
Real resource IDs/names should be written by either:

- Deploy Button provisioning flow
- `npm run deploy:one-click` script

## Cloudflare Bindings

应用依赖以下绑定，这些配置定义在 [`wrangler.jsonc`](/G:/my_project/CloudMind/wrangler.jsonc) 中：

- `DB`
- `ASSET_FILES`
- `ASSET_VECTORS`
- `WORKFLOW_QUEUE`
- `AI`

绑定类型定义位于 [`src/env.ts`](/G:/my_project/CloudMind/src/env.ts)。

## 测试

仓库当前包含以下方面的单元测试覆盖：

- ingest services 与 routes
- asset services 与 routes
- search services 与 routes
- chat services 与 routes
- MCP routes
- workflow services
- Workers AI adapter

基础校验命令：

```bash
npm run typecheck
npm run lint
npm run test
```

## 设计说明

重要实现约束：

- 原始资产必须保留，AI 派生结果应可重算
- 基础设施细节不应泄漏到业务逻辑中
- 优先使用 queue-driven workflows，而不是强耦合的同步处理链路
- AI 输出应被视为可替换、可重试的结果，而不是绝对真相
- 当部分派生产物缺失时，搜索与问答应能优雅降级

产品方向与架构约束可参考 [`AGENTS.md`](./AGENTS.md)。
