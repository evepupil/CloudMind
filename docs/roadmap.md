# CloudMind Roadmap

> 文档定位：项目唯一的现行路线图。
>
> 状态依据：截至 2026-07-24 的 `main` 分支代码、测试与提交记录。
>
> 状态只使用：`未开始`、`进行中`、`阻塞`、`已完成`。

## 项目目标

CloudMind 要交付一个可自行部署、数据由个人掌控的 AI 记忆层。当前主线是
在已经可用的采集、检索、知识图谱和 Web 产品之上，补齐记忆生命周期、
高级回忆方式、完整导出与稳定发布能力。

## 里程碑

| 里程碑 | 目标 | 状态 | 依赖 | 模块文档 | 退出标准 |
| --- | --- | --- | --- | --- | --- |
| [M0](#m0-采集与异步处理) | 打通 URL、文本、PDF 的采集与异步处理闭环 | 已完成 | 无 | [采集与异步处理](模块设计/采集与异步处理.md) | 三类内容可创建资产、进入工作流、生成派生产物，并支持失败重试 |
| [M1](#m1-检索与问答) | 建立可度量、可降级的混合检索与来源感知问答 | 已完成 | M0 | [检索与记忆处理](模块设计/检索与记忆处理.md) | FTS5、Vectorize、图召回、融合、重排、MMR 和离线 eval 全部可运行 |
| [M2](#m2-知识图谱与记忆整合) | 建立可追溯、可调和的 L2 双时间知识图谱 | 已完成 | M0、M1 | [知识图谱与记忆整合](模块设计/知识图谱与记忆整合.md) | entities、statements、edges、provenance 可从采集流程写入，能指回 L1 来源，并可参与检索和定时修复 |
| [M3](#m3-agent-记忆面) | 建立按记录类型、记忆域和项目上下文自由组合的记忆生命周期 | 进行中 | M1、M2、M6 阶段 A | [Agent 记忆面](模块设计/Agent记忆面.md) | `recordKind × scopeId × contextKey` 贯穿写入和检索，专用更新/遗忘与 Agent Web 可用，并通过组合过滤和项目隔离验证 |
| [M4](#m4-web-访问与管理) | 完成 Observatory Web 工作台与主要管理路径 | 已完成 | M0、M1、M2 | [Web 访问与管理](模块设计/Web访问与管理.md) | 首页、资产、采集、搜索、问答、记忆区和 Activity 均接入真实数据 |
| [M5](#m5-高级记忆模态) | 支持时间、联想、评价、聚合与关系强化类记忆操作 | 进行中 | M1、M2、M3 | [高级记忆模态](模块设计/高级记忆模态.md) | 补齐相对事件锚定、评价/超级值排序、跨记忆聚合、`reinforce` 和 `link`，并纳入 eval |
| [M6](#m6-数据主权与生命周期) | 兑现不可变原始快照、完整导出和可重建的数据主权 | 进行中 | 阶段 A：M0；阶段 B：M3 | [数据主权与生命周期](模块设计/数据主权与生命周期.md) | 文本、MCP 与 Agent 输入先有不可变快照；随后整库数据和 R2 文件可校验导出、导入与重建，遗忘后的跨存储状态一致 |
| [M7](#m7-工程质量与发布) | 把本地门禁扩展为开发前置保障和可重复发布 | 进行中 | 贯穿全部里程碑 | [工程质量与发布](模块设计/工程质量与发布.md) | 前置 CI 与 Cloudflare 集成门禁持续通过，并完成一次带迁移、回滚和生产冒烟的可复现发布 |

## M0 采集与异步处理

URL、文本和 PDF 已统一进入类型化 workflow；D1 记录资产、任务与步骤状态，
Vectorize 保存派生索引。URL、PDF 和文本输入均已保留 R2 原始内容；Web 文本、
MCP 与 Agent 输入会在派生处理前保存不可变快照，重处理继续读取首次归档的原文。

URL 重处理读取首次保存的 R2 快照，不重新抓取远端页面，也不会覆盖该快照。

完成依据：采集与工作流单测持续通过，`d3c6752` 修复 URL 不可变原始快照。

## M1 检索与问答

检索已经形成 dense、FTS5/BM25 和图召回三路输入，经融合、Workers AI
reranker 和 MMR 输出分组证据；问答复用同一证据链并允许模型故障降级。

完成依据：25 条离线查询的 Recall@10 为 1.0；`51377e3`、`1c0ecea`、
`613dad2`、`96f3f6e` 分别覆盖词面检索、重排和分阶段 eval。

## M2 知识图谱与记忆整合

L2 entities、statements、edges、provenance、communities 已落库。写路径包含实体抽取、
scope 内消歧和 ADD/UPDATE/DELETE/NOOP 调和；读路径包含图增强召回，定时任务负责
漂移边和重复数据修复。provenance 已直指 asset/chunk，episode 中间层已移除；实体
消歧、调和、图召回和定时修复均按 scope 与项目上下文隔离。

完成依据：`c1cc22b`、`ab694d8`、`fc87c6f`、`5ae90ae` 及对应单元测试。

## M3 Agent 记忆面

当前已提供 `remember`、`recall`、`remember_agent`、`recall_agent`，并完成
personal/agent scope 的写入、检索和实体向量隔离。M3-A0 已移除 episode，并让
`recordKind=library|memory`、`scopeId=personal|agent`、
`contextKey=global|project:<key>` 贯穿资产、chunk、向量 metadata 和 L2 图谱。
`remember_agent` 是客户端显式写入高密度工作记忆的工具；CloudMind 默认不保存
外部 AI 的完整会话原文。

M3-A1 已完成：list/search/ask/recall 支持三维数组组合过滤，旧单值参数继续兼容，
返回会回显实际过滤条件；写入工具可显式携带项目 `contextKey`。生产旧向量 metadata
已完成回填和复核。

M3-A2 已完成：`update_memory` 创建不可变候选版本，处理成功后原子切换当前版本；
`forget` 按 scope/项目软删除并清理 chunk 向量；`restore_memory` 从不可变快照重处理
并重建向量。三个工具都要求精确的 `scopeId + contextKey`。

M3-A3 的 Agent Web 已实现三维筛选、项目视图、详情、来源、版本历史以及更新、遗忘、
恢复；两个都含 `M1/M2` 的项目已通过本地 D1、FTS、L2 Workers 隔离测试。剩余一项是
部署后完成真实 Vectorize/L2 生产验收。用户如需归档完整会话，显式保存为 library
资产。通用资产 CRUD 不计作记忆生命周期能力。

## M4 Web 访问与管理

Observatory 设计系统、App Shell 和真实数据页面已经落地，覆盖 Overview、
Library、Asset Detail、Capture、Ask、Search、记忆图谱、时间线、整合和 Activity。

完成依据：`27e1b66` 至 `d2423ae` 的分阶段前端提交和构建门禁。

边界说明：M4 已交付通用 Web 工作台和只读的 personal 记忆视图；Agent 记忆管理页
随 M3 的生命周期能力交付，由 M4 提供页面组件和交互入口。

## M5 高级记忆模态

日期范围过滤、recency 排序、显著性衰减和关系类图召回已具备。相对事件锚定、
评价维度、超级值排序以及跨条目的计数、趋势和摘要仍待实现。用于强化既有记忆的
`reinforce` 和显式建立关系的 `link` 也归本里程碑。

下一步先为相对时间和评价查询增加金标准样本，再扩展写入与排序逻辑。

## M6 数据主权与生命周期

本里程碑分两个阶段。阶段 A 已完成：文本、MCP 和 Agent 输入会先保存不可变 R2
原始快照，再进入清洗、摘要、图谱和索引处理；重试可恢复“R2 已写、D1 尚未绑定”
的中断状态，已绑定快照禁止覆盖。阶段 B 在 M3 后完成版本化、分页或流式的整库
导出，覆盖 D1 元数据、R2 原文与派生文件、校验清单、导入、向量重建和恢复演练。
`forget` 的产品入口属于 M3，跨 D1/R2/Vectorize 的清理与恢复规则由本里程碑约束。

## M7 工程质量与发布

开发前置门禁已落地：GitHub Actions 与本地统一执行 `pnpm gate`，覆盖 Cloudflare
绑定类型漂移、密钥配置边界、Queue 原子认领/失败重投/DLQ，以及 Miniflare 中的
真实 D1 migrations 和 Queue ack/retry。M7 继续保持进行中；发布收尾阶段仍需处理
版本、CHANGELOG、远端迁移、部署、回滚和生产冒烟。

## 当前推进顺序

1. M3：Agent Web 和本地项目隔离验收已落地；部署后完成真实 Vectorize/L2 验收并
   关闭里程碑。
2. M6 阶段 B：完成完整导出、导入、重建和恢复演练。
3. M5：按 eval 样本推进相对时间、评价、聚合、强化和关联能力。
4. M7 发布收尾：建立版本、迁移、部署、回滚和生产验收流程。

## 历史路线图

以下文件只保留历史计划和决策背景，不再承载当前状态：

- [记忆层实施 Roadmap v2](roadmap-archive/memory-layer-roadmap-v2.md)
- [前端改造 Roadmap](roadmap-archive/frontend-rebuild-roadmap.md)
- [代码质量优化 Roadmap](roadmap-archive/code-quality-roadmap.md)

更新项目进度时只修改本文；实现细节、验证方式和改动历史写入对应模块文档。
