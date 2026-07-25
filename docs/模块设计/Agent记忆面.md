# Agent 记忆面

> 模块定位：通过 MCP 和 Web 完成个人与 Agent 记忆的写入、召回、更新、遗忘和管理。
>
> 对应代码：`src/features/{mcp,mcp-tokens,memory,search}/*`、`src/core/{assets,memory}/*`、
> `src/platform/db/d1/{schema,repositories}/*`、`skills/cloudmind-memory/*`
>
> 所属 M 里程碑：[`M3 Agent 记忆面`](../roadmap.md#m3-agent-记忆面)
>
> 当前状态：已完成
>
> 最近更新时间：2026-07-25

## 职责与边界

- 区分知识库资料与高密度长期记忆，并允许调用方显式组合过滤。
- 区分用户明确要求保存的 personal 记录与 Agent 主动沉淀的 agent 记录。
- 用稳定项目上下文隔离不同仓库里的里程碑、决策、进度和调试轨迹。
- 只保存用户或 Agent 选中的记忆内容；完整会话原文由用户显式归档。
- 复用 MCP token 鉴权、工具日志和统一错误返回。
- 为非技术用户生成通用 AI 安装提示词，完成 MCP 和 Skill 接入。
- 通用资产 CRUD 继续服务知识库管理，不代替专用记忆生命周期语义。

## 结构与数据流

```text
remember(_agent) -> recordKind + scopeId + contextKey -> immutable memory asset
                 -> chunks / vectors / L2 graph -> provenance(asset + chunk)
recall(_agent)   -> explicit three-axis filters -> hybrid search -> merged bundle
Agent Web        -> filterable list/detail -> update / forget / restore
MCP token page   -> JSON or client prompt -> MCP + Skill installation
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
8. AI 安装提示词可以携带当前 token，但必须明确禁止回显、日志、Git 和记忆写入；安装
   结果只报告脱敏状态。

## MCP 工具分组

当前 20 个工具仍全部平铺注册，使用时按五组理解：

| 分组 | 工具与目标 |
| --- | --- |
| 个人记忆 | `remember`、`recall`、`update_memory`、`forget`、`restore_memory` |
| Agent 记忆 | `remember_agent`、`recall_agent`；写入固定 `scopeId=agent` |
| 资料库 | `save_asset`、`list_assets`、`search_assets`、`search_assets_for_context`、`get_asset`、`ask_library`、`ask_library_for_context` |
| 资产管理 | `update_asset`、`delete_asset`、`restore_asset`、`reprocess_asset` |
| 运维 | `list_asset_workflows`、`get_workflow_run` |

`remember` 固定写 `memory + personal`；`remember_agent` 固定写
`memory + agent`；`save_asset` 固定写 `library`。三个写入工具都接收 `contextKey`，
省略时兼容旧客户端写入 global。`recall_agent` 默认查询 memory，并同时允许 personal
与 agent 两个 scope；调用方应传当前项目 `contextKey`，省略时只查 global。

`search_assets_for_context` 与 `ask_library_for_context` 在兼容期继续保留；实现三维
过滤后，分别并入带显式 `profile` 的 `search_assets` 与 `ask_library`，减少工具数量。

## 客户端记忆工作流

仓库内的 `skills/cloudmind-memory` 是 MCP 记忆能力的客户端使用规则。服务端工具描述
继续说明单个工具的参数和语义，Skill 负责跨工具判断：什么时候召回、写到哪个 scope、
怎样选择项目上下文，以及什么时候应当跳过写入。`agents/openai.yaml` 声明 CloudMind
MCP 依赖并允许 Codex 隐式调用；BYOC 部署地址由用户自己的 MCP 配置提供。

Skill 使用以下规则：

- 用户背景、偏好和个人历史走 `recall`；项目延续、既有决策和工作轨迹走
  `recall_agent`。一次组织 1 至 5 个查询并批量召回。
- 用户明确要求记住时走 `remember`，归 personal；Agent 主动保存长期有用的决策、
  进度、结果、阻塞或下一步时走 `remember_agent`，归 agent。
- 项目记忆从规范化 Git remote 生成 `contextKey`，例如
  `project:github:evepupil/CloudMind`。没有稳定 remote 时，禁止把项目事实静默写成
  global；项目召回显式传 `contextKeys`，禁止依赖 `recall_agent` 的 global 默认值。
- 写入前按目标 scope 和精确 context 召回去重；已有事实发生变化时走
  `update_memory`，并保留目标原有 scope。
- 用户明确要求归档完整会话时走 personal library 资产；普通聊天、秘密、临时日志和
  未确认推测不进入记忆。
- `forget` 默认 soft，只有用户明确确认指定 ID 永久删除时才允许 hard；Agent 不做
  自主清理。

这层规则属于选择性客户端采用，不会让服务端自动捕获外部会话。新会话会根据 Skill
描述隐式触发；调试时也可用 `$cloudmind-memory` 显式触发。

`/mcp-tokens` 为每个有效 token 提供两种交付形态：通用 MCP 配置 JSON 和通用 AI
安装提示词。提示词要求当前 AI 自行识别客户端安装方式，直接完成用户级 MCP 配置、
安装仓库中的 `skills/cloudmind-memory`、只读核对关键工具，并全程对 token 脱敏。

## 当前实现

- `remember`、`recall`、`remember_agent`、`recall_agent` 四个 MCP 工具。
- `skills/cloudmind-memory` 已提供召回、写入、去重更新、遗忘、恢复和完整会话归档的
  客户端决策流程，并声明 CloudMind MCP 依赖与隐式触发策略。
- MCP token 页面支持“给 AI 的提示词 / 配置 JSON”切换和一键复制；安装提示词不区分
  客户端，包含 MCP、Skill、只读验证和 secret 处理边界。
- `recordKind`、`scopeId`、`contextKey` 已贯穿 asset、chunk、D1 检索、Vectorize
  metadata、实体消歧、statement、edge 和 provenance。
- `remember` 与 `remember_agent` 已固定写 memory；普通采集默认写 library。
- personal/agent 独立写入和检索；不同项目的同名实体、陈述和漂移修复互不影响。
- provenance 已直接指向 asset/chunk；episodes schema、仓储端口和 workflow 写入已删除。
- 日期窗口、相关性/最近优先排序和可见性门控。
- 现有 `update_asset`、`delete_asset`、`restore_asset` 等通用管理工具。
- `/memory/agent` 已提供独立记忆控制台：默认查看 `memory + agent`，也可自由组合
  recordKind、scopeId、contextKey，并切换当前、已遗忘和全部状态。
- Agent Web 包含按 contextKey 聚合的项目视图、记忆详情、不可变版本历史、来源与
  原始快照指针；知识资料从同一筛选页钻取通用资产详情。
- list/search/ask/recall 已支持 `recordKinds`、`scopeIds`、`contextKeys` 数组过滤，
  同维度 OR、不同维度 AND；省略维度不限制。旧单值参数继续可用，新旧同维参数一起
  出现时明确拒绝。
- `recall` 默认应用 `memory + personal`；`recall_agent` 默认应用
  `memory + personal|agent + global`。所有读工具返回 `appliedRecordFilters`。
- `update_memory` 创建带根版本、版本号和上一版本指针的新 memory 候选；候选通过
  Queue 完成处理后，D1 原子地将旧版本标记为 superseded 并激活新版本。候选失败时
  旧版本继续有效。
- `forget` 和 `restore_memory` 要求精确 `scopeId + contextKey`。forget 默认 soft，软删除
  D1 记录并清理 chunk 向量；restore 从首次不可变 R2 快照重新处理并重建向量。
  已软删除的当前记忆可用 `mode=hard + confirmId=id` 清理整条版本链，hard 不可恢复。
- 列表、FTS、摘要、dense 命中补齐和图证据 hydration 均排除 superseded 版本；
  按 ID 仍可读取版本历史。
- Web 更新、遗忘、恢复表单全部调用专用生命周期服务，并提交精确的
  `scopeId + contextKey`；重复更新会在已有候选版本处理中时被拒绝。
- 通用资产、搜索、问答、首页和活动页继续显式限制 personal，Agent 数据集中在
  `/memory/agent` 管理。

## 验证方式

MCP schema/路由、过滤规范化、D1 条件、Vectorize `$in`、Ask、图召回、工具默认值、
生命周期服务和 Web 管理读模型均有单元测试。Workers 集成测试用两个都含 `M1/M2`
的项目验证 D1 列表、FTS chunk、L2 statement/provenance 全程隔离，并在真实 0017
migration 后验证新旧 memory 版本原子切换；项目汇总和完整版本链也在真实 D1 上验证。

部署后使用 `scripts/record-filter-acceptance.mjs` 做只读真实 MCP 验收；完整记忆质量
仍可用 `scripts/recall-acceptance.mjs` 和 `scripts/recall-schema-acceptance.mjs` 检查。
M3-A3 使用 `scripts/project-isolation-acceptance.mjs` 临时写入两个都含 `M1/M2` 的
Agent 项目记忆，验证生产 D1 列表、FTS/Vectorize 混合检索和 L2 statement 证据后，
在 finally 中调用 `forget` 清理活跃测试数据。生产验收通过：2 条测试记录均已遗忘，
活跃数为 0，对应 chunk 向量残留数为 0。

M6 使用 `scripts/hard-delete-acceptance.mjs` 验证已软删除 memory 的整条版本链可从
D1、R2、chunk Vectorize、图 Vectorize 和独占 L2 中清理，完成审计只保留目标哈希、
数量和时间；生产验收已经通过。

客户端 Skill 使用 Skill Creator 的 `quick_validate.py` 检查目录、frontmatter 和命名；
再以旧项目续接、个性化建议、用户要求记住、修正旧记忆、普通闲聊、秘密信息和完整
会话归档七类行为用例检查工具选择。用户级安装后需要新建 Codex 任务，让 Codex 重新
发现 Skill 和全局 `AGENTS.md`。

安装提示词纯函数测试覆盖三类客户端、MCP 地址与 token 注入、Skill 路径、只读验证、
禁止写入 Git/记忆和最终脱敏报告。切换与复制属于展示交互，通过构建和人工检查验证。

## 实施计划

### M3-A0：简化核心模型（已完成）

- 为资产、chunk、向量 metadata 和 L2 图谱贯穿 `recordKind` 与 `contextKey`；沿用
  现有 `scopeId`。
- 先重建 provenance 并保留 `assetId/chunkIndex`，再删除 `episodeId`、episodes 表、
  repository 端口和 workflow 中的 `createEpisode`。禁止依赖级联直接删表。
- 实体唯一性、调和候选和图召回改为 `scopeId + contextKey` 隔离。

### M3-A1：整理 MCP 与组合过滤（已完成）

- `remember`、`remember_agent`、`save_asset` 写入固定的 recordKind/scope 组合。
- 写入工具接收显式 `contextKey`；客户端在 Git 项目中优先传规范化 remote key。
- recall/search 支持三个维度数组过滤，落实“维度内 OR、维度间 AND、省略不限制”。
- 兼容期保留旧工具名和 global 默认值，并在返回中暴露实际应用的三维过滤条件。

### M3-A2：专用生命周期（已完成）

- `update_memory` 创建新版本，旧版本保留并标记 superseded。
- `forget` 先做可恢复软删除；恢复时重建缺失向量，硬删除规则由 M6 约束。
- M6 已给同一 `forget` 增加显式 hard 模式；Web 继续只提供可恢复遗忘，永久删除由
  MCP 精确确认触发并进入审计。
- 通过 scope/context 校验阻止跨项目误更新和误删除。

### M3-A3：Agent Web 与验收（已完成）

- 提供 recordKind、scopeId、contextKey 三维筛选和项目视图。
- 支持记忆详情、来源、版本历史、更新、遗忘与恢复。
- 用两个都含 `M1/M2` 的测试项目完成 D1、FTS、Vectorize、L2 图谱端到端隔离验收。

## 待扩展项

- M6 的完整导出、导入、恢复和 hard delete 验收已完成；发布自动化归 M7。
- 专用 `reinforce`、`link` 已移出当前 roadmap；现有自动访问强化和图谱关系继续保留。
- 完整会话归档沿用显式 personal library 资产，不进入 Agent 记忆默认路径。
- 当前已用 AI 安装提示词完成最短接入路径；Codex Plugin 或
  `cloudmind setup-agent codex` 保留为批量分发与无人值守场景的后续增强。

## 改动历史

- 2026-07-25：安装提示词改为客户端无关，由 AI 自行识别安装方式；复制交互移到全站
  静态脚本，修复站内局部导航后按钮无响应的问题。
- 2026-07-25：MCP token 页面新增 AI 安装提示词，与配置 JSON 切换并支持一键复制；
  提示词内置 token 脱敏、Skill 安装和只读验证边界。
- 2026-07-24：M5 退出当前 roadmap；Agent 记忆面维持现有生命周期工具边界。
- 2026-07-24：新增 `cloudmind-memory` 客户端 Skill，落实主动召回、选择性沉淀、
  项目 key、写前去重、生命周期安全边界和 MCP 依赖声明，并开始本机体验验证。
- 2026-07-24：M6 生产 hard delete 和数据包 v2 恢复验收通过，确认版本链跨存储清理、
  审计最小化和项目过滤可恢复。
- 2026-07-24：`forget` 增加保持向后兼容的 soft/hard 模式；hard 要求目标已软删除、
  `confirmId` 完全一致，并清理完整 memory 版本链。
- 2026-07-24：M3-A3 生产验收通过；两个同含 `M1/M2` 的项目在 D1、FTS、Vectorize
  和 L2 statement 证据中保持隔离，验收数据全部遗忘且 chunk 向量清理为 0，M3 关闭。
- 2026-07-24：完成 M3-A3 本地实现，增加三维筛选、项目视图、详情、来源、完整版本
  历史、更新/遗忘/恢复入口，以及双项目 D1/FTS/L2 Workers 验收和生产验收脚本。
- 2026-07-24：完成 M3-A2，增加 memory 版本链、异步成功后原子激活、专用
  `update_memory`/`forget`/`restore_memory`、严格 scope/context 校验和恢复重索引。
- 2026-07-24：完成 M3-A1，三维数组过滤贯穿 D1、Vectorize、图召回和 MCP；保留
  旧单值参数并增加冲突校验、默认策略、过滤回显、生产向量回填和只读验收脚本。
- 2026-07-24：完成 M3-A0，移除 episode，落地三维字段、项目隔离、迁移保护、
  sleep-time 跨项目修复和 Vectorize metadata 索引。
- 2026-07-24：取消自动会话原文捕获和 episode 目标模型，锁定
  `recordKind × scopeId × contextKey` 三维设计与 M3-A0 至 A3 实施顺序。
- 2026-07-23：聚焦自动情节捕获、专用更新/遗忘和 Agent Web，移出高级记忆动词。
- 2026-07-22：补齐模块归档并明确已完成与待办边界。
- 2026-06-07：完成 agent scope 隔离与专用 remember/recall。
- 2026-06-07：完成人的 personal scope 记忆闭环。
