# CloudMind AGENTS.md

## 项目定位

CloudMind 是一个 **开源、个人可控、serverless-first 的 AI 时代个人知识库**。

它不是 SaaS 托管服务，而是面向个人用户的 **BYOC（Bring Your Own Cloud）** 项目：

- 用户自己部署到自己的 Cloudflare 账号与存储资源
- 用户自己掌控原始数据、摘要、索引与导出
- 默认优先支持 Cloudflare 原生设施
- 架构上保留未来迁移到 `PostgreSQL + pgvector` 的能力

当前阶段目标是：**优先做出可用的快速原型（MVP）**，而不是一开始追求最完美的长期架构。

---

## 当前产品定义

CloudMind 可以理解为一个“全自动知识库”：

1. 把网页、文件、笔记、AI 对话中的重要内容收进来
2. 自动清洗、总结、分类、向量化
3. 存成可搜索、可追问、可复用的知识资产
4. 通过 Web UI 和 MCP 提供访问能力

当前优先面向：

- 开发者
- 重度信息收藏者
- 使用 Claude / Cursor / Gemini API 等 AI 工具的高级用户
- 希望拥有“自己的知识库”而不是把数据交给 SaaS 的用户

---

## MVP 原则

### 必须遵守

- 先做闭环，再做复杂度
- 先做单用户，再考虑多人/协作
- 先做可用采集，再做复杂知识图谱
- 先做全文与语义检索，再做高级自动推理
- 所有原始资产必须保留，AI 派生内容可以重算
- 所有核心模块都应有清晰的适配器边界，避免未来迁移困难

### 当前明确不做

- 复杂多人权限系统
- 高级图谱可视化
- 自动实体对齐/复杂知识合并
- 重型工作流编排界面
- 视频全文转录
- 图片 OCR 全流程
- 社交化功能

---

## MVP 技术路线

### 推荐默认栈

- 全栈框架：`HonoX`
- 路由与 API：`Hono`
- 部署平台：`Cloudflare Pages`
- 结构化元数据：`Cloudflare D1`
- 原始文件/快照：`Cloudflare R2`
- 向量索引：`Cloudflare Vectorize`
- 异步处理：`Cloudflare Queues`
- AI 能力：`Cloudflare Workers AI`
- 可选网页渲染：`Cloudflare Browser Rendering`
- 可选缓存/临时状态：`Cloudflare KV`

当前项目代码结构采用 **单个 HonoX 全栈项目**，而不是前后端分离的 monorepo。

### 为什么当前不用 PostgreSQL + pgvector 作为 MVP 默认

因为当前优先目标是快速原型与极简部署：

- 尽量减少外部基础设施账号与配置成本
- 尽量留在 Cloudflare 原生生态内完成第一版
- 等产品闭环成立后，再评估迁移到更强的主数据库方案

### 未来迁移方向

后续如果出现以下情况，可以考虑迁移核心数据层到 `PostgreSQL + pgvector`：

- 查询复杂度明显上升
- 需要更强的关系建模能力
- 需要更可控的数据迁移与备份能力
- 需要减少 `D1 + Vectorize` 双写与同步复杂度

因此，代码设计上必须从第一天起保留以下抽象边界：

- `AssetRepository`
- `BlobStore`
- `VectorStore`
- `JobQueue`
- `AIProvider`

业务层不得直接把 D1 / R2 / Vectorize 的具体实现写死在核心逻辑中。

---

## 模块划分

CloudMind 当前拆为四个核心模块。

### 1. 采集模块（Ingest）

负责把外部信息抓进系统。

MVP 包含：

- URL 保存
- 文本保存
- PDF 上传
- MCP 写入入口

MVP 暂缓：

- 图片深度解析
- 视频转录
- 邮件转发入口
- 各类第三方 App 集成

### 2. 处理模块（Process）

负责把原始内容转成可用资产。

MVP 包含：

- 正文抽取
- 清洗为干净文本/Markdown
- 自动摘要
- 自动标签/分类
- 分块（chunking）
- 向量化（embedding）
- 写入索引

### 3. 存储模块（Store）

负责持久化原始内容与派生资产。

MVP 包含：

- D1 存资产元数据
- R2 存原始内容与清洗结果
- Vectorize 存 chunk 向量

### 4. 展示与对话模块（Access）

负责给用户和 AI 使用知识库。

MVP 包含：

- Web 管理后台
- 资产列表页
- 资产详情页
- 搜索页
- AI 问答页
- MCP server

---

## 核心用户流程

### 流程 1：保存网页

1. 用户通过插件或 Web UI 提交 URL
2. Worker 创建 `asset` 记录，状态为 `pending`
3. 原始抓取结果写入 R2
4. 投递队列任务
5. 异步处理生成摘要、标签、chunks、embeddings
6. 写入 D1 / Vectorize
7. `asset.status` 更新为 `ready`

### 流程 2：上传 PDF

1. 用户上传 PDF
2. 文件写入 R2
3. D1 创建资产记录
4. 队列任务负责抽文本、清洗、摘要、向量化
5. 最终可在 Web UI 中搜索与查看

### 流程 3：AI 对话存档（MCP）

1. AI 客户端调用 MCP 工具提交内容
2. Worker 将内容按 `text/chat` 资产写入
3. 经过统一处理流水线入库
4. 后续可被语义搜索与问答检索

### 流程 4：知识问答

1. 用户提出问题
2. 系统对 query 生成 embedding
3. 从 Vectorize 检索相关 chunks
4. 到 D1 补齐元数据与来源信息
5. 必要时从 R2 取原始内容片段
6. 用 Workers AI 生成带来源感知的回答

---

## 功能需求

### P0：必须有

- URL 保存
- 文本保存
- PDF 上传
- 资产异步处理
- 自动摘要
- 自动标签
- 向量检索
- 资产列表与详情
- 基于知识库的聊天问答
- MCP 基础能力
- 失败任务可重试

### P1：尽快补

- 浏览器插件
- 标签筛选
- 手动编辑摘要/标签
- 重新处理资产
- 导出 `JSON/NDJSON`
- 删除资产与软删除
- 搜索结果引用来源

### P2：后续再做

- 图片 OCR
- 视频/音频转录
- 更细粒度知识图谱关系
- 自动关联“相似资产”
- 多模型支持
- 本地模型支持

---

## 非功能需求

- 单用户优先
- 自部署优先
- 默认低成本
- 默认无长期运维心智负担
- 支持导出与迁移
- 尽量减少平台锁定
- 原始资产不可丢失
- AI 派生数据可重建

---

## 数据模型（MVP）

### `assets`

存资产主记录。

建议字段：

- `id`
- `type`：`url | pdf | note | image | chat`
- `title`
- `source_url`
- `summary`
- `status`：`pending | processing | ready | failed`
- `raw_r2_key`
- `content_r2_key`
- `created_at`
- `updated_at`

### `asset_chunks`

存切块后的片段元数据。

建议字段：

- `id`
- `asset_id`
- `chunk_index`
- `text_preview`
- `vector_id`

### `tags`

- `id`
- `name`

### `asset_tags`

- `asset_id`
- `tag_id`

### `ingest_jobs`

记录异步任务状态。

建议字段：

- `id`
- `asset_id`
- `job_type`
- `status`
- `error`
- `created_at`
- `updated_at`

---

## API 设计（MVP）

### Ingest

- `POST /api/ingest/url`
- `POST /api/ingest/file`
- `POST /api/ingest/text`

### Assets

- `GET /api/assets`
- `GET /api/assets/:id`
- `POST /api/reprocess/:id`
- `DELETE /api/assets/:id`

### Search / Chat

- `POST /api/search`
- `POST /api/chat`

### MCP

MVP 只提供最小工具集：

- `save_asset`
- `search_assets`
- `get_asset`
- `ask_library`

---

## 队列任务设计

MVP 队列任务可拆成以下步骤：

1. `fetch_source`
2. `extract_content`
3. `clean_content`
4. `summarize`
5. `classify`
6. `chunk`
7. `embed`
8. `index`
9. `finalize`

允许前期先在一个 consumer 中顺序完成，后续再拆细。

---

## 项目结构建议

建议使用 monorepo：

- `apps/web`：Web UI
- `apps/worker`：API / MCP / Queue consumer
- `packages/core`：领域模型与接口抽象
- `packages/db`：D1 访问层
- `packages/blob`：R2 访问层
- `packages/vector`：Vectorize 访问层
- `packages/ai`：Workers AI 适配层
- `packages/ingest`：内容抓取、抽取、清洗、chunking
- `packages/mcp`：MCP 工具定义

---

## 编码与架构约束

### 核心原则

- 业务逻辑与基础设施实现分离
- 优先小步快跑，不做过度设计
- 保持接口清晰，便于后续迁移
- 先实现最小闭环，再补高级能力

### 必须避免

- 在业务代码中直接散落 SQL / R2 / Vectorize 细节
- 在多个地方重复实现内容抽取逻辑
- 把 AI 输出当成绝对真相，不做兜底
- 把摘要/标签作为唯一数据源，原始文本必须保留

### AI 处理原则

- AI 负责摘要、分类、提炼
- AI 输出必须允许失败和重试
- AI 输出必须可替换、可重算
- 不得因摘要失败而阻塞原始资产保存

---

## 版本目标

### v0.1

- URL / 文本 / PDF 采集
- 异步处理
- 摘要 + 标签 + embedding
- 搜索与资产详情

### v0.2

- AI 问答
- MCP 接入
- 浏览器插件
- 重处理与导出

### v0.3

- 更好的分类与相关推荐
- 多 provider AI 抽象
- 准备向 Postgres + pgvector 的可选迁移路径

---

## 迁移预留要求

尽管当前 MVP 采用 `D1 + R2 + Vectorize`，但所有新代码都必须考虑未来迁移：

- 不假设 D1 是唯一数据库实现
- 不假设 Vectorize 是唯一向量实现
- 不假设 Workers AI 是唯一模型提供方
- 所有资产都应能导出
- 所有向量都应允许重建

未来迁移目标优先级：

1. `PostgreSQL + pgvector`
2. 任意 `S3-compatible storage`
3. 多 AI provider 支持

---

## 当前一句话目标

先做出一个 **能保存网页/PDF/文本，能自动总结、能语义搜索、能聊天追问、能被 MCP 调用** 的开源个人知识库原型。

---

## 技术栈选型

以下技术栈选择是当前项目的默认方向，用于指导后续实现与依赖控制。

### 必选

- **Framework:** `HonoX + Hono`
- **Language:** `TypeScript`（strict mode，禁止 `any`）
- **Styling:** `Tailwind CSS 4`
- **UI:** `shadcn/ui`、`Radix UI`
- **Animation:** `Motion`（按需引入）
- **Database:** `Cloudflare D1`
- **ORM:** `Drizzle ORM` + `drizzle-kit`
- **Validation:** `Zod` + `drizzle-zod`
- **Forms:** `React Hook Form`
- **Storage:** `Cloudflare R2`，并保留 `S3-compatible` 抽象
- **AI:** `Workers AI / OpenAI / DeepSeek / Xiaomi MiMo`，通过统一 `AIProvider` 抽象切换
- **Async Processing:** `Cloudflare Queues`
- **Lint / Format:** `Biome`
- **Testing:** `Vitest`
- **Package Manager:** `pnpm`

### 可选

- **AI Gateway:** `Cloudflare AI Gateway`
- **Rate Limiting:** `Upstash Redis`（未配置时必须优雅降级）
- **Monitoring:** `Sentry`
- **Cloud Logging:** `Axiom`
- **Storage SDK:** `@aws-sdk/client-s3`

### 暂缓

- **Auth:** `Better Auth`
  - 技术上可用，但当前阶段不是 MVP 必需能力
  - 仅在需要账号体系或第三方 OAuth 时再引入
- **Advanced Workflow Engine:** `Inngest`
  - 当前优先使用 `Cloudflare Queues`
  - 如后续出现复杂长流程编排需求，再评估引入
- **Payments:** `Creem`
  - 当前项目定位为开源、自部署、非 SaaS
  - 暂不进入 MVP 技术栈

### 禁用 / 不采用

- **`Next.js`**
  - 当前项目不是 Next.js 应用
  - 不使用 App Router / `pages/` / Server Actions 体系
- **`next-safe-action`**
  - 仅适用于 Next.js Server Actions 生态
  - 当前项目不采用
- **`next-intl`**
  - 当前项目不是 Next.js 应用
  - 后续如需国际化，选择更通用方案
- **`Fumadocs` 作为主应用运行时依赖**
  - 可作为独立文档站方案单独评估
  - 不进入主应用技术栈

### 当前推荐组合

当前 CloudMind 的推荐组合如下：

- 全栈框架：`HonoX + Hono`
- 语言：`TypeScript` strict
- UI：`Tailwind CSS 4 + shadcn/ui + Radix UI + Motion`
- 数据层：`D1 + Drizzle ORM + drizzle-kit + Zod + drizzle-zod`
- 存储层：`R2` + `@aws-sdk/client-s3` 抽象
- 异步处理：`Cloudflare Queues`
- AI：`Workers AI / OpenAI / DeepSeek / Xiaomi MiMo` 多 provider 抽象
- 表单：`React Hook Form + Zod`
- 可观测性：`Sentry` / `Axiom` 可选
- 工具链：`Biome + pnpm + Vitest`

### 架构判断

- 当前项目以 **Cloudflare 原生 MVP** 为优先目标
- 数据库层优先选择 `D1`，而不是一开始引入外部 `PostgreSQL`
- ORM 与校验统一采用 `Drizzle + Zod` 体系
- 所有 AI provider 必须通过统一抽象层接入，不允许在业务代码中直接散落具体厂商 SDK
- 所有可选基础设施必须支持“未配置时优雅降级”

---

## 工程初始化约束

### 目录结构

项目采用 **单个 HonoX 全栈项目**：

- `app/*`：HonoX 入口、页面路由与渲染层
- `src/features/*`：按 feature 划分的业务代码
- `src/env.ts`：运行环境类型

代码组织优先采用 **feature-first** 目录结构，而不是只按 controller / service / util 做纯技术分层。

推荐目录约定：

- `app/routes/*`：页面 route
- `app/server.ts`：全栈应用入口
- `src/features/<feature>/components/*`：页面组件
- `src/features/<feature>/server/*`：API / 服务端逻辑
- `src/features/<feature>/model/*`：领域类型与模型

### 语言与类型系统

- 全项目统一使用 `TypeScript`
- 必须开启严格类型检查（strict mode）
- 不允许为了省事关闭严格模式
- 尽量通过清晰类型建模替代隐式约定

### 代码注释

- 代码注释统一使用中文
- 代码标识符、函数名、变量名、类型名保持英文
- 注释应解释意图与边界，不要写无意义注释

### 路径别名

- 项目统一使用路径别名：`@/* -> src/*`

### 格式化规范

统一使用 `Biome`，并遵守以下格式：

- double quotes
- semicolons
- trailing commas (ES5)
- 2-space indent
- 80 char line width

### Lint 规则

以下规则必须视为错误：

- `noExplicitAny: error`
- `noUnusedImports: error`
- `noUnusedVariables: error`
- `useImportType: error`
