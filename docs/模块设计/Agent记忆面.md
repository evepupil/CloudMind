# Agent 记忆面

> 模块定位：通过 MCP 和 Web 完成个人与 Agent 记忆的写入、召回、更新、遗忘和管理。
>
> 对应代码：`src/features/{mcp,memory,search}/*`、`src/core/{assets,memory}/*`、`src/platform/db/d1/{schema,repositories}/*`
>
> 所属 M 里程碑：[`M3 Agent 记忆面`](../roadmap.md#m3-agent-记忆面)
>
> 当前状态：进行中
>
> 最近更新时间：2026-07-24

## 职责与边界

- 区分知识库资料与高密度长期记忆，并允许调用方显式组合过滤。
- 区分用户明确要求保存的 personal 记录与 Agent 主动沉淀的 agent 记录。
- 用稳定项目上下文隔离不同仓库里的里程碑、决策、进度和调试轨迹。
- 只保存用户或 Agent 选中的记忆内容；完整会话原文由用户显式归档。
- 复用 MCP token 鉴权、工具日志和统一错误返回。
- 通用资产 CRUD 继续服务知识库管理，不代替专用记忆生命周期语义。

## 结构与数据流

```text
remember(_agent) -> recordKind + scopeId + contextKey -> immutable memory asset
                 -> chunks / vectors / L2 graph -> provenance(asset + chunk)
recall(_agent)   -> explicit three-axis filters -> hybrid search -> merged bundle
Agent Web        -> filterable list/detail -> update / forget / restore
```

核心三元组：

| 维度 | 值 | 含义 |
| --- | --- | --- |
| `recordKind` | `library \| memory` | 资料资产或长期记忆 |
| `scopeId` | `personal \| agent` | 用户明确要求保存，或 Agent 主动选择保存 |
| `contextKey` | `global \| project:<stable-key>` | 全局有效，或只属于一个项目 |

三个维度互相独立。同一维度的多个值按 OR 组合，不同维度按 AND 组合；省略某个
过滤维度表示不限制。项目 key 优先使用规范化 Git remote，例如
`project:github:evepupil/CloudMind`，本机路径只作展示信息。

## 关键决策

1. `recordKind` 只描述记录形态，`scopeId` 只描述记忆域，`contextKey` 只描述适用
   上下文；禁止用一个字段代替另外两个字段。
2. AI 可见性使用 allow、summary_only、deny，显式选择优先于自动分类。
3. recall 一次接收 1 至 5 个子查询，统一去重后返回，减少循环调用。
4. 三个维度贯穿 D1、FTS、Vectorize metadata 和 L2 图谱；实体消歧与调和至少按
   `scopeId + contextKey` 隔离，避免不同项目的 `M1`、`M2` 等同名概念合并。
5. CloudMind 不自动保存完整会话。Agent 只在决策、进度、结果、阻塞或下一步值得
   跨会话延续时写一条简短、自包含的 memory。用户显式保存完整会话时走 library。
6. `update_memory` 创建新版本并让旧版本失效；`forget` 默认软删除。二者都直接作用
   于 memory 记录，不创建 correction episode。
7. L2 provenance 直接指向 asset/chunk。episode 中间层不参与目标架构。

## MCP 工具分组

当前 17 个工具仍全部平铺注册，目标按职责收敛为四组：

| 分组 | 工具与目标 |
| --- | --- |
| 个人记忆 | `remember`、`recall`、`update_memory`、`forget` |
| Agent 记忆 | `remember_agent`、`recall_agent`；写入固定 `scopeId=agent` |
| 知识库 | `save_asset`、`list_assets`、`search_assets`、`get_asset`、`ask_library` 和资产管理工具 |
| 运维 | `list_asset_workflows`、`get_workflow_run`，后续通过独立配置暴露 |

`remember` 固定写 `memory + personal`；`remember_agent` 固定写
`memory + agent`；`save_asset` 固定写 `library`。`recall_agent` 默认按当前
`contextKey` 查询 memory，同时允许 personal 与 agent 两个 scope，因此能同时看到
用户明确要求保存的项目记忆和 Agent 自己的项目记忆。

`search_assets_for_context` 与 `ask_library_for_context` 在兼容期继续保留；实现三维
过滤后，分别并入带显式 `profile` 的 `search_assets` 与 `ask_library`，减少工具数量。

## 当前实现

- `remember`、`recall`、`remember_agent`、`recall_agent` 四个 MCP 工具。
- `recordKind`、`scopeId`、`contextKey` 已贯穿 asset、chunk、D1 检索、Vectorize
  metadata、实体消歧、statement、edge 和 provenance。
- `remember` 与 `remember_agent` 已固定写 memory；普通采集默认写 library。
- personal/agent 独立写入和检索；不同项目的同名实体、陈述和漂移修复互不影响。
- provenance 已直接指向 asset/chunk；episodes schema、仓储端口和 workflow 写入已删除。
- 日期窗口、相关性/最近优先排序和可见性门控。
- 现有 `update_asset`、`delete_asset`、`restore_asset` 等通用管理工具。
- Web 记忆区当前只读 personal scope，尚无 Agent scope 管理页面。
- MCP 对外参数当前仍是单值 scope 入口，尚未提供三维数组组合过滤和过滤回显。

## 验证方式

MCP 路由、记忆写入、scope 过滤和 recall 排序已有单元测试。M3-A0 另有真实 D1
迁移测试，验证 provenance 保留后再删 episodes；Workers 集成测试验证不同项目的
同名概念和定时修复隔离。后续仍需覆盖三维数组过滤真值表、版本更新、软删除恢复
和工具默认过滤；上线前还需执行 `scripts/recall-acceptance.mjs`、
`scripts/recall-schema-acceptance.mjs` 和真实 MCP 客户端验收。

## 实施计划

### M3-A0：简化核心模型（已完成）

- 为资产、chunk、向量 metadata 和 L2 图谱贯穿 `recordKind` 与 `contextKey`；沿用
  现有 `scopeId`。
- 先重建 provenance 并保留 `assetId/chunkIndex`，再删除 `episodeId`、episodes 表、
  repository 端口和 workflow 中的 `createEpisode`。禁止依赖级联直接删表。
- 实体唯一性、调和候选和图召回改为 `scopeId + contextKey` 隔离。

### M3-A1：整理 MCP 与组合过滤

- `remember`、`remember_agent`、`save_asset` 写入固定的 recordKind/scope 组合。
- 写入工具接收显式 `contextKey`；客户端在 Git 项目中优先传规范化 remote key。
- recall/search 支持三个维度数组过滤，落实“维度内 OR、维度间 AND、省略不限制”。
- 兼容期保留旧工具名和 global 默认值，并在返回中暴露实际应用的三维过滤条件。

### M3-A2：专用生命周期

- `update_memory` 创建新版本，旧版本保留并标记 superseded。
- `forget` 先做可恢复软删除；恢复时重建缺失向量，硬删除规则由 M6 约束。
- 通过 scope/context 校验阻止跨项目误更新和误删除。

### M3-A3：Agent Web 与验收

- 提供 recordKind、scopeId、contextKey 三维筛选和项目视图。
- 支持记忆详情、来源、版本历史、更新、遗忘与恢复。
- 用两个都含 `M1/M2` 的测试项目完成 D1、FTS、Vectorize、L2 图谱端到端隔离验收。

## 待扩展项

- 完成 M3-A1 至 M3-A3；`reinforce`、`link` 继续归 M5。
- 完整会话归档作为显式 library 能力评估，不进入 Agent 记忆默认路径。

## 改动历史

- 2026-07-24：完成 M3-A0，移除 episode，落地三维字段、项目隔离、迁移保护、
  sleep-time 跨项目修复和 Vectorize metadata 索引。
- 2026-07-24：取消自动会话原文捕获和 episode 目标模型，锁定
  `recordKind × scopeId × contextKey` 三维设计与 M3-A0 至 A3 实施顺序。
- 2026-07-23：聚焦自动情节捕获、专用更新/遗忘和 Agent Web，移出高级记忆动词。
- 2026-07-22：补齐模块归档并明确已完成与待办边界。
- 2026-06-07：完成 agent scope 隔离与专用 remember/recall。
- 2026-06-07：完成人的 personal scope 记忆闭环。
