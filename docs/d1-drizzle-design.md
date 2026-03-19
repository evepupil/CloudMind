# D1 + Drizzle + drizzle-zod 设计文档

## 目标

本文档定义 CloudMind 在 MVP 阶段的数据层设计方案，采用以下组合：

- 数据库：`Cloudflare D1`
- ORM：`Drizzle ORM`
- Schema / Migration：`drizzle-kit`
- 类型验证：`Zod`
- DB Schema 到 Zod 的桥接：`drizzle-zod`

当前目标是：

1. 支持知识资产的基础存储与读取
2. 支持后续 URL / 文本 / PDF / MCP 写入
3. 支持异步处理状态追踪
4. 支持未来接入 R2、Vectorize、Queues
5. 保持未来迁移到 `PostgreSQL + pgvector` 的可能性

---

## 为什么当前选 D1 + Drizzle + drizzle-zod

### D1

D1 适合当前阶段的原因：

- Cloudflare 原生，部署简单
- 对 MVP 非常友好
- 适合个人知识库的中小规模结构化数据
- 能与 Pages / Workers / Queues 平滑协作

当前不选择 PostgreSQL 作为 MVP 主库，主要是为了：

- 降低部署复杂度
- 减少额外云服务依赖
- 优先验证产品闭环

### Drizzle ORM

选择 Drizzle 的原因：

- 类型安全好
- 对 SQL 结构表达清晰
- 对 SQLite / D1 支持成熟
- 迁移到 PostgreSQL 时模型心智基本一致
- 适合我们强调 strict TypeScript 的工程要求

### drizzle-zod

选择 drizzle-zod 的原因：

- 可以从表结构导出 Zod schema
- 降低表结构与输入校验之间的漂移
- 适合在 API 层、表单层、后台任务层统一复用验证逻辑

---

## 设计原则

### 1. 数据库只存“真相源”

D1 中只保存：

- 资产主记录
- 处理状态
- 标签关系
- 片段元数据
- 文件键名
- 任务状态
- 可重建的派生信息索引

D1 不保存：

- 大体积原始文件内容
- PDF 二进制
- 图片二进制
- 原始网页快照大文本

这些内容应放到 R2。

### 2. 原始资产优先于 AI 派生结果

必须保证：

- 原始数据可保留
- 摘要、标签、embedding 可重算
- AI 输出失败不影响主资产落库

### 3. 表结构为 feature 服务

表结构围绕 CloudMind 当前核心 feature：

- ingest
- assets
- tags
- processing
- search

不为了“未来可能的复杂图谱”过早设计过多关系。

### 4. 为未来迁移预留边界

虽然当前使用 D1，但代码设计必须保证未来可迁移：

- 仓储层与业务层解耦
- 不在业务代码中散落 D1 SQL 细节
- 避免依赖 SQLite 特有行为作为核心业务前提

---

## 当前数据域划分

MVP 数据域拆分如下：

1. `assets`：知识资产主表
2. `asset_chunks`：切块元数据
3. `tags`：标签表
4. `asset_tags`：资产与标签关联
5. `ingest_jobs`：异步处理任务
6. `asset_sources`：来源与抓取信息

如果后续需要，可再增加：

- `asset_revisions`
- `conversations`
- `conversation_messages`
- `search_logs`

当前先不进入第一版 schema。

---

## 表设计

### 1. `assets`

知识资产主表。

建议字段：

- `id`：主键，字符串 UUID / cuid 风格
- `type`：资产类型
  - `url`
  - `pdf`
  - `note`
  - `image`
  - `chat`
- `title`：标题
- `summary`：摘要
- `status`：处理状态
  - `pending`
  - `processing`
  - `ready`
  - `failed`
- `sourceUrl`：原始 URL，可为空
- `rawR2Key`：原始文件或快照在 R2 的 key
- `contentR2Key`：清洗后文本 / markdown 在 R2 的 key
- `mimeType`：原始内容 MIME
- `language`：可选语言标记
- `createdAt`
- `updatedAt`
- `processedAt`：可为空
- `failedAt`：可为空
- `errorMessage`：可为空

用途：

- 资产列表
- 资产详情
- 搜索结果补充元信息
- 处理状态展示

### 2. `asset_sources`

记录资产来源信息。

建议字段：

- `id`
- `assetId`
- `kind`
  - `manual`
  - `browser_extension`
  - `upload`
  - `mcp`
  - `import`
- `sourceUrl`
- `externalId`
- `metadataJson`
- `createdAt`

用途：

- 记录资产来自哪里
- 支持未来多入口采集
- 避免把所有来源信息都塞到 `assets` 主表

### 3. `asset_chunks`

记录切块后的文本片段元数据。

建议字段：

- `id`
- `assetId`
- `chunkIndex`
- `textPreview`
- `contentR2Key`：若 chunk 内容不直接放库，可存片段文件 key
- `vectorId`：Vectorize 中的向量 ID
- `tokenCount`
- `createdAt`

用途：

- 语义检索命中后回溯到资产
- 展示引用片段
- 后续重建索引

### 4. `tags`

标签主表。

建议字段：

- `id`
- `name`
- `kind`
  - `tag`
  - `project`
  - `topic`
- `createdAt`
- `updatedAt`

用途：

- 标签筛选
- 项目分类
- 聚合展示

### 5. `asset_tags`

资产与标签关联表。

建议字段：

- `assetId`
- `tagId`
- `createdAt`

约束：

- 复合唯一键 `assetId + tagId`

### 6. `ingest_jobs`

异步任务状态表。

建议字段：

- `id`
- `assetId`
- `jobType`
  - `fetch_source`
  - `extract_content`
  - `clean_content`
  - `summarize`
  - `classify`
  - `chunk`
  - `embed`
  - `index`
  - `finalize`
- `status`
  - `queued`
  - `running`
  - `succeeded`
  - `failed`
- `attempt`
- `errorMessage`
- `payloadJson`
- `createdAt`
- `updatedAt`
- `finishedAt`

用途：

- 前端展示处理进度
- 调试失败任务
- 手动重试

---

## 推荐索引策略

D1 是 SQLite 语义，MVP 先保持保守索引。

建议索引：

### `assets`

- `status`
- `type`
- `createdAt`
- `updatedAt`
- `sourceUrl`

### `asset_chunks`

- `assetId`
- `vectorId`
- `chunkIndex`

### `tags`

- `name` 唯一索引
- `kind`

### `asset_tags`

- `assetId`
- `tagId`
- `assetId + tagId` 唯一索引

### `ingest_jobs`

- `assetId`
- `status`
- `jobType`
- `createdAt`

---

## Drizzle 目录设计

当前建议目录结构：

```txt
src/
  db/
    client.ts
    schema/
      assets.ts
      asset-sources.ts
      asset-chunks.ts
      tags.ts
      asset-tags.ts
      ingest-jobs.ts
      index.ts
    repositories/
      assets-repository.ts
      ingest-jobs-repository.ts
    zod/
      assets.ts
      ingest-jobs.ts
```

说明：

- `schema/*`：Drizzle 表定义
- `repositories/*`：数据库读写封装
- `zod/*`：基于 drizzle-zod 生成或扩展的 Zod schema
- `client.ts`：D1/Drizzle 初始化

---

## Drizzle 代码层职责边界

### `schema`

负责：

- 表定义
- 字段类型
- 默认值
- 索引与关系的静态描述

不负责：

- 业务逻辑
- 输入校验逻辑拼装
- 复杂查询流程

### `repositories`

负责：

- 面向业务的数据库读写接口
- 复用常见查询
- 隐藏 D1 查询细节

例如：

- `listAssets()`
- `getAssetById()`
- `createAsset()`
- `updateAssetStatus()`
- `attachTagsToAsset()`

### `zod`

负责：

- API 输入验证
- 表单输入验证
- 内部 job payload 校验

---

## drizzle-zod 使用策略

推荐做法：

1. 先从 Drizzle schema 生成基础 schema
2. 再在业务层组合更严格的输入 schema

例如：

- `insertAssetSchema`：来自 `createInsertSchema(assets)`
- `selectAssetSchema`：来自 `createSelectSchema(assets)`
- `createTextAssetInputSchema`：基于基础 schema 进一步裁剪与强化
- `createUrlAssetInputSchema`
- `ingestTextPayloadSchema`

原因：

- 表结构 schema 反映“数据库允许什么”
- API 输入 schema 反映“业务接口允许什么”
- 两者不应完全等同

### 示例边界

数据库允许：

- `summary` 为空
- `processedAt` 为空
- `errorMessage` 为空

但 API 创建资产输入不一定允许客户端传这些字段。

因此：

- **不要直接把 insert schema 当公开 API 输入 schema 原样使用**
- 应在 drizzle-zod 生成结果上做 pick / omit / extend

---

## API 层验证设计

建议把 API 输入验证分成以下几类：

### 采集输入

- `ingestTextPayloadSchema`
- `ingestUrlPayloadSchema`
- `ingestUploadPayloadSchema`
- `ingestMcpPayloadSchema`

### 资产查询输入

- `assetListQuerySchema`
- `assetDetailParamsSchema`
- `assetSearchQuerySchema`

### 后台任务输入

- `enqueueJobPayloadSchema`
- `retryJobPayloadSchema`

---

## 与 R2 / Vectorize 的关系

### D1 与 R2

关系：

- D1 保存 key
- R2 保存正文与文件本体

推荐规则：

- 原始文件不落 D1
- 清洗后的大文本原则上也不直接落 D1
- D1 只保存摘要、状态和关键索引字段

### D1 与 Vectorize

关系：

- D1 保存 `asset_chunks`
- Vectorize 保存向量本体
- `vectorId` 在两侧做关联

推荐规则：

- D1 负责 chunk 元数据与回溯
- Vectorize 负责相似度检索
- 向量可重建，不把 Vectorize 视为唯一真相源

---

## MVP 查询场景

第一阶段必须覆盖的查询：

1. 列表页
   - 按创建时间倒序
   - 可按状态过滤
   - 可按类型过滤

2. 详情页
   - 根据 `id` 获取资产
   - 获取相关标签
   - 获取处理状态

3. 搜索结果整合
   - 通过 `vectorId` 找回 `asset_chunks`
   - 再回查 `assets`

4. 任务状态页
   - 查看某个资产的处理任务
   - 查看失败原因

---

## 初版迁移策略

建议采用 Drizzle migration 管理：

- 所有 schema 变更通过 migration 管理
- 不允许手写线上库变更后不回填 migration
- migration 文件进入版本控制

推荐节奏：

1. 建 `assets`
2. 建 `asset_sources`
3. 建 `asset_chunks`
4. 建 `tags` / `asset_tags`
5. 建 `ingest_jobs`

---

## 命名规范

### 表名

统一使用复数小写蛇形：

- `assets`
- `asset_sources`
- `asset_chunks`
- `tags`
- `asset_tags`
- `ingest_jobs`

### 字段名

统一使用小写驼峰映射到 DB 列名，Drizzle 层可显式绑定下划线列名。

例如：

- 代码：`createdAt`
- DB：`created_at`

### 主键

当前建议：

- 文本主键 `text`
- 应用层生成 ID

原因：

- 对 Cloudflare / 前端 / MCP 更方便
- 后续迁移 PostgreSQL 时也容易兼容

---

## 实现顺序建议

### 第一阶段

- `assets`
- `ingest_jobs`
- `asset_sources`

先跑通：

- 文本资产创建
- 列表页
- 详情页
- 基础处理状态

### 第二阶段

- `tags`
- `asset_tags`
- `asset_chunks`

再补：

- 标签筛选
- 搜索结果回溯
- chunk 级引用

### 第三阶段

- 重试任务
- 资产重新处理
- 更强的来源元数据

---

## 风险与注意事项

### 1. D1 不适合直接承担大文本仓库

必须避免把全文原文都塞进 D1。

### 2. drizzle-zod 不能代替业务输入建模

它能减少重复，但不能直接替代所有 API 输入 schema 设计。

### 3. 不要把队列状态只放在内存或日志里

异步处理一定要回写 `ingest_jobs`，否则前端无法感知状态。

### 4. 资产状态与任务状态要分开

- `assets.status` 表示用户视角的整体可用状态
- `ingest_jobs.status` 表示任务级别执行状态

二者不能混为一谈。

---

## 当前结论

CloudMind 在 MVP 阶段的数据层设计建议为：

- 用 `D1` 做结构化主库
- 用 `Drizzle ORM` 做表定义与查询封装
- 用 `drizzle-kit` 做 migration
- 用 `drizzle-zod + Zod` 做类型验证与输入 schema 组合
- 用 `R2` 放原始内容
- 用 `Vectorize` 放向量

这套设计的重点不是一步到位，而是：

- 先跑通资产闭环
- 保持类型安全
- 控制实现复杂度
- 为未来迁移保留余地
