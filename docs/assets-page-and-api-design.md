# Assets 页面与 API 设计文档

## 目标

本文档定义 CloudMind 在 MVP 阶段的 `assets` 页面与 API 设计。

目标：

1. 支持资产列表页
2. 支持资产详情页
3. 支持基础采集入口
4. 支持处理状态展示
5. 为后续搜索、标签筛选、重新处理、MCP 写入预留扩展空间

当前阶段先聚焦单用户、单项目、自部署场景。

---

## 设计范围

当前文档覆盖以下内容：

- 前端页面信息架构
- 页面与 API 的交互关系
- 路由设计
- API 请求 / 响应结构
- 页面状态设计
- 后续扩展方向

当前不覆盖：

- D1 具体 schema 实现
- Drizzle 代码实现细节
- R2 / Vectorize / Queues 实际接入代码
- UI 视觉稿

---

## 产品视角下的 `assets`

在 CloudMind 中，`asset` 是一个知识资产单元。

它可以是：

- 一个网页
- 一个 PDF
- 一段笔记
- 一段聊天内容
- 一张图片

用户当前最核心的资产操作有四类：

1. 看已有资产
2. 看某个资产的详情
3. 新增资产
4. 看处理是否成功

因此 MVP 先围绕以下页面和 API 打通闭环：

- 资产列表页
- 资产详情页
- 文本采集 API
- URL 采集 API
- 资产详情 API
- 资产列表 API

---

## 页面设计

### 1. 资产列表页

建议路由：

- `/assets`

### 页面目标

让用户快速看到：

- 已保存了哪些资产
- 资产当前状态
- 大概内容是什么
- 哪些还在处理中
- 能否点进去看详情

### 首屏信息建议

每条资产卡片至少包含：

- 标题
- 类型
- 摘要
- 状态
- 创建时间
- 来源 URL（如果有）
- 标签（第一版可选）

### 列表页 MVP 功能

- 默认按 `createdAt desc` 排序
- 支持按 `status` 过滤
- 支持按 `type` 过滤
- 支持基础搜索框（先做标题/摘要/URL 级过滤即可）
- 点击进入详情页

### 列表页状态

需要考虑：

- `loading`
- `empty`
- `error`
- `ready`

### 列表页第一版组件建议

可拆成：

- `AssetListPage`
- `AssetListFilters`
- `AssetList`
- `AssetCard`
- `AssetStatusBadge`
- `AssetEmptyState`

---

### 2. 资产详情页

建议路由：

- `/assets/[id]`

### 页面目标

展示单个资产的完整信息，并为未来的搜索引用、处理重试、重新摘要等能力做准备。

### 详情页 MVP 内容

#### 基础信息

- 标题
- 类型
- 状态
- 创建时间
- 更新时间
- 来源 URL
- MIME 类型
- 语言

#### 内容信息

- 摘要
- 原始内容入口（如果可访问）
- 清洗内容入口（第一版可为占位）

#### 处理信息

- 当前处理状态
- 最近一次失败信息
- 是否已处理完成

#### 标签信息

- 当前标签列表
- 第一版可只读显示

#### 来源信息

- 来源类型：`manual` / `browser_extension` / `upload` / `mcp`
- 来源 URL

### 详情页状态

需要考虑：

- `loading`
- `not_found`
- `error`
- `ready`

### 详情页第一版组件建议

可拆成：

- `AssetDetailPage`
- `AssetHeader`
- `AssetMetaSection`
- `AssetSummarySection`
- `AssetSourceSection`
- `AssetProcessingSection`
- `AssetTagsSection`

---

### 3. 资产创建入口

MVP 不一定先做独立页面，也可以优先从 API + 一个简单表单开始。

建议最终会有：

- `/assets/new`

但当前 MVP 可以先在首页或 `/assets` 页面上提供两个最小表单：

- 文本资产创建
- URL 资产创建

### 创建入口 MVP 字段

#### 文本资产

- `title`
- `content`

#### URL 资产

- `url`
- `title`（可选，允许系统后续覆盖）

---

## 路由设计

### 页面路由

- `/`
- `/assets`
- `/assets/[id]`

### API 路由

- `GET /api/assets`
- `GET /api/assets/:id`
- `POST /api/ingest/text`
- `POST /api/ingest/url`

### 预留路由

- `POST /api/assets/:id/reprocess`
- `DELETE /api/assets/:id`
- `GET /api/assets/:id/jobs`
- `PATCH /api/assets/:id`

---

## API 设计

### 1. `GET /api/assets`

用于列表页。

#### Query 参数

建议支持：

- `status`
- `type`
- `query`
- `page`
- `pageSize`

第一版可以先简化为：

- `status`
- `type`
- `query`

#### 响应结构

```json
{
  "items": [
    {
      "id": "asset_xxx",
      "type": "url",
      "title": "Rust 视频精华",
      "summary": "介绍了 Rust 所有权与借用。",
      "status": "ready",
      "sourceUrl": "https://example.com/video",
      "createdAt": "2026-03-19T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1
  }
}
```

#### 说明

- 即使第一版暂时不做分页，响应结构也建议先预留 `pagination`
- 列表响应应避免返回过多详情字段

---

### 2. `GET /api/assets/:id`

用于详情页。

#### 响应结构

```json
{
  "item": {
    "id": "asset_xxx",
    "type": "url",
    "title": "Rust 视频精华",
    "summary": "介绍了 Rust 所有权与借用。",
    "status": "ready",
    "sourceUrl": "https://example.com/video",
    "rawR2Key": "raw/asset_xxx.html",
    "contentR2Key": "content/asset_xxx.md",
    "mimeType": "text/html",
    "language": "zh",
    "createdAt": "2026-03-19T10:00:00.000Z",
    "updatedAt": "2026-03-19T10:02:00.000Z",
    "processedAt": "2026-03-19T10:02:00.000Z",
    "errorMessage": null,
    "tags": [
      { "id": "tag_rust", "name": "rust", "kind": "topic" }
    ],
    "source": {
      "kind": "browser_extension",
      "sourceUrl": "https://example.com/video"
    }
  }
}
```

#### 404 响应

```json
{
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "Asset not found"
  }
}
```

---

### 3. `POST /api/ingest/text`

用于创建文本资产。

#### 请求体

```json
{
  "title": "会议笔记",
  "content": "今天讨论了 CloudMind 的首页结构。"
}
```

#### 输入约束

- `title`：可选，允许为空字符串时由系统兜底
- `content`：必填，非空

#### 响应结构

```json
{
  "ok": true,
  "item": {
    "id": "asset_xxx",
    "type": "note",
    "title": "会议笔记",
    "status": "pending",
    "createdAt": "2026-03-19T10:00:00.000Z"
  }
}
```

#### 处理逻辑

服务端需要：

1. 创建 `assets` 主记录
2. 创建 `asset_sources`
3. 创建 `ingest_jobs`
4. 后续交给队列异步处理

第一版即使队列还没接上，也建议保持这个接口语义。

---

### 4. `POST /api/ingest/url`

用于创建 URL 资产。

#### 请求体

```json
{
  "url": "https://example.com/article",
  "title": "可选标题"
}
```

#### 输入约束

- `url`：必填，合法 URL
- `title`：可选

#### 响应结构

```json
{
  "ok": true,
  "item": {
    "id": "asset_xxx",
    "type": "url",
    "title": "可选标题",
    "status": "pending",
    "createdAt": "2026-03-19T10:00:00.000Z"
  }
}
```

#### 后续处理

异步任务需要继续完成：

- 抓取原网页
- 抽正文
- 清洗内容
- 生成摘要
- 生成标签
- 切块
- embedding
- 入向量索引

---

## 前后端交互建议

### 列表页

- 页面服务端加载时调用 `GET /api/assets` 或直接走 server service
- 如果后续要做客户端筛选，可保留 API 调用能力

### 详情页

- 页面服务端加载时调用 `GET /api/assets/:id` 或直接走 server service
- 页面不应自行拼数据库逻辑

### 创建资产

- 表单提交到 `POST /api/ingest/text` / `POST /api/ingest/url`
- 成功后跳转到：
  - `/assets`
  - 或 `/assets/[id]`

建议第一版优先跳转到详情页，方便用户看到处理状态。

---

## 页面层与服务端层职责

### 页面层

负责：

- 展示 UI
- 收集用户输入
- 渲染列表 / 详情 / 状态

不负责：

- 直接访问数据库
- 直接操作 D1 / R2 / Queues

### 服务端层

负责：

- 参数验证
- 调用 repository
- 组织 API 响应
- 生成适合页面消费的数据结构

### Repository 层

负责：

- 访问 `assets` / `asset_sources` / `tags` / `ingest_jobs`
- 提供稳定的查询接口

---

## 状态设计

### 资产状态

资产主状态建议统一为：

- `pending`
- `processing`
- `ready`
- `failed`

### 页面展示语义

- `pending`：已创建，等待处理
- `processing`：正在处理中
- `ready`：可用
- `failed`：处理失败，需要查看原因或重试

### 任务状态

任务状态由 `ingest_jobs` 管理，不与资产状态混用。

---

## 错误处理设计

### 列表接口错误

返回：

```json
{
  "error": {
    "code": "ASSET_LIST_FAILED",
    "message": "Failed to load assets"
  }
}
```

### 详情接口错误

返回：

```json
{
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "Asset not found"
  }
}
```

### 创建接口错误

返回：

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid request payload",
    "details": {
      "fieldErrors": {
        "content": ["Content is required"]
      }
    }
  }
}
```

建议：

- 所有输入错误都通过 `Zod` 格式化输出
- 所有业务错误都提供稳定 `code`

---

## Zod 验证建议

建议在 `assets` feature 下建立：

```txt
src/features/assets/
  model/
    types.ts
  server/
    routes.ts
    service.ts
    repository.ts
    schemas.ts
```

### 推荐 schema

- `assetListQuerySchema`
- `assetIdParamsSchema`
- `ingestTextPayloadSchema`
- `ingestUrlPayloadSchema`
- `assetStatusSchema`
- `assetTypeSchema`

---

## 推荐实现顺序

### 第一阶段

- `GET /api/assets`
- `/assets`
- `GET /api/assets/:id`
- `/assets/[id]`

目标：

- 跑通列表页和详情页

### 第二阶段

- `POST /api/ingest/text`
- 简单创建表单

目标：

- 跑通最小资产写入闭环

### 第三阶段

- `POST /api/ingest/url`
- 处理状态 UI
- 错误提示与重试入口

目标：

- 跑通最小采集与处理闭环

---

## 扩展预留

未来可扩展：

- 标签筛选
- 分页
- 资产编辑
- 删除资产
- 重试处理
- 查看处理任务明细
- 搜索结果引用 chunk
- MCP 创建资产
- 上传 PDF / 图片

---

## 当前结论

CloudMind 的 `assets` 页面与 API 在 MVP 阶段应优先满足以下最小闭环：

1. 用户能看到资产列表
2. 用户能打开资产详情
3. 用户能创建文本资产
4. 用户能创建 URL 资产
5. 用户能看到处理状态

实现上应遵循：

- 页面负责展示
- API 负责输入输出语义
- repository 负责数据库访问
- `Zod` 负责请求验证
- `Drizzle` 负责持久化

这样后续接入 D1、R2、Queues、Vectorize 时，扩展成本最低。
