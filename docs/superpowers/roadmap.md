# CloudMind 代码质量优化 Roadmap

## 产品目标

CloudMind v0.1 MVP 功能闭环已完成，本轮目标：**在不改变产品行为的前提下，系统性地清偿代码质量债**，提升可维护性、类型安全、测试覆盖。

## 当前阶段

**v0.1 代码优化轮** —— 专注代码结构改进，不做新功能。

---

## Milestones

| ID | Milestone | 目标 | 状态 | 优先级 | 依赖 | 证据 |
|----|-----------|------|------|--------|------|------|
| M1 | 消除重复代码 + 修静默错误 | 3 个工作流文件去重，修 5 处 catch{}，修 1 个 lint 警告 | `done` | P0 | 无 | commit 0f6e062: typecheck+lint+test 通过，-1230 行 |
| M2 | 拆分大文件 | d1-asset-repository、chat/service、indexing-policy 按职责拆分 | `done` | P0 | M1 | commits 86714c7 e712a4f 8f11878: 3 文件拆为 10 模块 |
| M2.5 | 恢复质量门禁 | 固定换行格式基线，修复 MCP 鉴权测试与 Workers AI 返回字段断言，让 typecheck/lint/test 重新全绿 | `done` | P0 | M2 | 2026-05-31: `pnpm typecheck`、`pnpm lint`、`pnpm test` 全部通过 |
| M3 | 类型安全加固 | 工作流状态解析加 Zod 校验，补 Logger 核心接口 | `active` | P1 | M2 | M3.1 已完成：共享 workflow steps 的关键 state 读取改为 Zod 校验，新增 2 个回归测试 |
| M4 | 补测试覆盖 | indexing-policy、auto-enrichment、runtime 加单元测试 | `planned` | P1 | M2 | — |

---

## 活跃工作

- M3：类型安全加固。M3.1 工作流状态 Zod 校验已完成，M3.2 Logger 核心接口待做。

---

## 下一步建议

1. **完成 M3.2**：Logger 核心接口
2. **启动 M4**：补 indexing-policy、auto-enrichment、runtime 测试

---

## M1 详情：消除重复 + 修静默错误

### 1.1 工作流文件去重

**问题**：`note-ingest-workflow.ts`（521行）、`url-ingest-workflow.ts`（590行）、`pdf-ingest-workflow.ts`（549行）共 ~1660 行，其中 10+ 个步骤实现完全相同：
`clean_content`、`summarize`、`derive_descriptor`、`derive_access_policy`、`derive_facets`、`derive_assertions`、`persist_content`、`chunk`、`embed`、`index`、`finalize`

**方案**：
- 新建 `src/features/workflows/server/shared-workflow-steps.ts`
- 将 11 个共享步骤提取为纯函数，接受通用依赖
- 3 个 workflow 文件只保留 `load_source` 步骤 + `runXxxWorkflow()` 入口
- 每个文件的 `runXxxWorkflow()` 引用共享步骤拼装完整的步骤列表

**影响文件**：
- `src/features/workflows/server/note-ingest-workflow.ts`
- `src/features/workflows/server/url-ingest-workflow.ts`
- `src/features/workflows/server/pdf-ingest-workflow.ts`
- `src/features/workflows/server/registry.ts`（可能需要更新 import）

### 1.2 修静默 catch{}

| 文件 | 行号（约） | 修复方式 |
|------|-----------|----------|
| `workflows/server/note-ingest-workflow.ts` | 112 | 记录 error 日志 + 返回 undefined |
| `workflows/server/runtime.ts` | 85, 443 | JSON.parse 失败时记录日志 + 返回 fallback |
| `workflows/components/asset-workflows-page.tsx` | 69 | 记录 error + 显示 fallback UI |
| `ingest/server/service.ts` | 430 | 记录 fallback AI 调用失败 |

### 1.3 Biome lint 警告

- `search/server/service.ts:272`：`!chunk || !chunk.vectorId` → `!chunk?.vectorId`

---

## M2 详情：拆分大文件

### 2.1 `d1-asset-repository.ts`（1413行 → 4 模块）

当前一个 class 实现 24 个方法，覆盖 `AssetQueryRepository`、`AssetSearchRepository`、`AssetIngestRepository`、`AssetMutationRepository` 四个子接口。

**方案**：按子接口拆为 4 个独立模块：
- `d1-asset-query-repository.ts` — list、getById、getByVectorIds 等查询
- `d1-asset-search-repository.ts` — searchByTerms、searchFacets 等搜索
- `d1-asset-ingest-repository.ts` — create、createChunks、createFacets 等写入
- `d1-asset-mutation-repository.ts` — update、softDelete、restore 等变更
- 保留 `d1-asset-repository.ts` 作为组合入口，委托给上述 4 个模块

### 2.2 `chat/server/service.ts`（1296行 → 3 模块）

当前 `createChatService` 闭包内包含检索、证据组装、LLM 调用全部逻辑。

**方案**：
- `chat/server/retrieval.ts` — 查询 embedding → vector/lexical 检索 → 合并
- `chat/server/evidence.ts` — 上下文选择、token 评分、去重、排序
- `chat/server/service.ts` — 保留编排层：调用检索 → 证据 → LLM → 后处理

### 2.3 `indexing-policy.ts`（982行 → 3 模块）

当前一个文件包含 domain 推导、classifier、access-policy、facet 推导、assertion 推导。

**方案**：
- `workflows/server/policies/domain-classifier.ts` — domain、documentClass 推导
- `workflows/server/policies/access-policy.ts` — sensitivity、aiVisibility 推导
- `workflows/server/policies/facet-deriver.ts` — facet 生成
- `indexing-policy.ts` 保留为组合入口

---

## M3 详情：类型安全加固

### 3.1 工作流状态 Zod 校验

**问题**：42 处 `as` 类型断言中，约 20 处来自工作流运行时状态解析（`Record<string, unknown>` → 具体类型）。

**方案**：
- 为 `AssetDescriptor`、`AssetAccessPolicy`、`PreparedChunk`、`CreateAssetChunkInput` 定义 Zod schema
- 在 `runtime.ts` 的 step 输入/输出解析点，用 `schema.parse()` 替代 `as` 断言
- 解析失败时记录结构化错误并返回失败步骤状态

**进展**：
- 已在 `shared-workflow-steps.ts` 中覆盖 descriptor、accessPolicy、persistedContent、embeddings、indexedChunks 的读取边界
- 已新增 `shared-workflow-steps.test.ts`，覆盖坏 chunks / indexedChunks 不会继续进入 embedding / finalize
- `runtime.ts` 的通用 state 解析边界仍保留为后续可选加固点

### 3.2 Logger 核心接口

**问题**：`createLogger` 在 `src/platform/observability/logger.ts`，9 个 feature 文件直接 import 平台实现。

**方案**：
- 新增 `src/core/logging/ports.ts`，定义 `Logger` 接口（info/warn/error 方法）
- `createLogger` 实现该接口
- Feature 层通过依赖注入接收 `Logger`，而非直接 import

---

## M4 详情：补测试覆盖

### 未测试的关键模块

| 文件 | 行数 | 测试策略 |
|------|------|----------|
| `indexing-policy.ts` | 982 | 纯函数，输入 content + metadata → 输出 domain/class/facets。单元测试覆盖所有分支 |
| `auto-enrichment.ts` | 605 | Mock AIProvider，测试分类/描述/候选/选择的边界情况 |
| `runtime.ts` | 446 | 用内存 mock 替代 D1/Queue，测试完整 step 执行流程 |
| `WorkersAIProvider.createEmbeddings` | — | 补 embedding 方法的单元测试 |

---

## 验收标准

每批完成后必须通过：

```bash
pnpm typecheck   # tsc --noEmit，零错误
pnpm lint        # Biome，零警告
pnpm test        # Vitest，全绿
```

---

## 不纳入本轮

以下项目已明确不做：

- AI Provider 多模型支持（OpenAI/DeepSeek/MiMo）— 独立 roadmap
- 首页真实数据 — P1 功能，非代码质量债
- 浏览器插件 — P1 功能
- 导出 JSON/NDJSON — P1 功能
- image_ingest_v1 / chat_ingest_v1 实现 — P2 功能

---

## 风险和未知

| 风险 | 影响 | 状态 |
|------|------|------|
| 工作流去重可能引入行为差异 | 回归风险 | 通过现有 19 个测试文件兜底 |
| d1-asset-repository 拆分后跨模块事务 | 数据一致性 | D1 不支持真正的事务，保持原有单独写入模式 |
| M2+ 模块拆分后 import 路径大量变更 | 合并冲突风险 | 每批拆分后立即跑全量 typecheck+test |

---

## 决策记录

| 日期 | 决定 | 原因 |
|------|------|------|
| 2026-05-31 | 本轮只做代码质量债，不做新功能 | 用户明确"优化方面"，AI provider 多模型推迟 |
| 2026-05-31 | M1 优先于 M2 | 去重和静默错误影响面大、改动可控、风险低 |
| 2026-05-31 | 大文件按子接口/职责拆分，保留组合入口 | 不破坏现有调用方，渐进式改进 |

---

## 近期进展

- **M3.1 完成**（2026-05-31）：共享 workflow steps 的关键 state 读取改为 Zod 校验，新增坏 persisted chunks / indexed chunks 的回归测试；`pnpm typecheck`、`pnpm lint`、`pnpm test` 全部通过
- **M2.5 完成**（2026-05-31）：新增 `.gitattributes` 固定 LF 换行，修复 MCP bearer token 鉴权测试与 Workers AI provider 字段断言；`pnpm typecheck`、`pnpm lint`、`pnpm test` 全部通过
- **M2 完成**（2026-05-31）：commits `86714c7` `e712a4f` `8f11878`
  - M2.1: `indexing-policy.ts`（982行）拆为 4 模块（domain-classifier, access-policy, facet-deriver, types-and-helpers）
  - M2.2: `chat/server/service.ts`（1296行）提取 retrieval.ts + grounding.ts
  - M2.3: `d1-asset-repository.ts`（1413行）提取 helpers 模块（-380行）
- **M1 完成**（2026-05-31）：commit `0f6e062`，工作流去重 -1230 行 + 5 处 catch{} + lint 修复
- 3 个 agent 并行探索完成，产出结构分析、特征分析、质量分析三份报告
- Roadmap 初始化
