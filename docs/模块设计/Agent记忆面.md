# Agent 记忆面

> 模块定位：通过 MCP 和 Web 完成 Agent 记忆的捕获、召回、更新、遗忘与管理。
>
> 对应代码：`src/features/mcp/*`、`src/features/memory/server/memory-write.ts`、`src/features/search/server/recall.ts`、`src/core/memory/scope.ts`、`src/platform/db/d1/repositories/d1-memory-repository.ts`
>
> 所属 M 里程碑：[`M3 Agent 记忆面`](../roadmap.md#m3-agent-记忆面)
>
> 当前状态：进行中
>
> 最近更新时间：2026-07-23

## 职责与边界

- 为个人记忆提供高密度写入、批量子查询召回和可见性控制。
- 为 Agent 自身的决策、进度和工作轨迹提供独立 scope。
- 接收客户端提交的对话事件，形成可追溯 episode，并提供 Agent Web 管理入口。
- 复用 MCP token 鉴权、工具日志和统一错误返回。
- 通用资产 CRUD 继续服务知识库管理，不代替专用记忆生命周期语义。

## 结构与数据流

```text
remember(_agent) -> scoped fast write -> asset/episode -> L2 processing
recall(_agent)   -> fixed scope + visibility -> hybrid search -> merged bundle
client capture   -> immutable input -> episode -> reconciliation
Agent Web        -> scoped list/detail -> update / forget / restore
```

personal 召回只读取个人 scope；agent 召回必须显式调用 `recall_agent`。

## 关键决策

1. 人的长期记忆与 Agent 工作轨迹物理共用模型，逻辑上强制 scope 隔离。
2. AI 可见性使用 allow、summary_only、deny，显式选择优先于自动分类。
3. recall 一次接收 1 至 5 个子查询，统一去重后返回，减少循环调用。
4. 所有 scope 过滤在 repository 和向量元数据层同时生效。
5. MCP 服务无法直接观察外部客户端的完整对话；自动捕获依赖客户端集成主动提交，
   服务端负责校验、去重、持久化和后续处理。
6. `update_memory` 通过 correction episode 保留修改来源；`forget` 先采用可恢复
   语义，硬删除交由 M6 的跨存储清理规则约束。

## 当前实现

- `remember`、`recall`、`remember_agent`、`recall_agent` 四个 MCP 工具。
- personal/agent 独立写入、检索、实体向量和迁移工具。
- 日期窗口、相关性/最近优先排序和可见性门控。
- 现有 `update_asset`、`delete_asset`、`restore_asset` 等通用管理工具。
- Web 记忆区当前只读 personal scope，尚无 Agent scope 管理页面。

## 验证方式

MCP 路由、记忆写入、scope 过滤和 recall 排序均有单元测试。上线前还需执行
`scripts/recall-acceptance.mjs`、`scripts/recall-schema-acceptance.mjs` 和真实 MCP
客户端验收。

## 待扩展项

- 增加 `update_memory` 和 `forget` 专用工具；`reinforce`、`link` 归 M5。
- 建立客户端对话提交协议，自动捕获 `chat_turn`、`agent_assert`、`correction`
  等 episode，并提供去重、开关和来源查看。
- 增加 Agent Web 列表、详情、筛选、更新、遗忘和恢复入口。
- 增加 scope 隔离的端到端部署验证。

## 改动历史

- 2026-07-23：聚焦自动情节捕获、专用更新/遗忘和 Agent Web，移出高级记忆动词。
- 2026-07-22：补齐模块归档并明确已完成与待办边界。
- 2026-06-07：完成 agent scope 隔离与专用 remember/recall。
- 2026-06-07：完成人的 personal scope 记忆闭环。
