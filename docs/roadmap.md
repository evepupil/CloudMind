# CloudMind Roadmap

> 文档定位：项目唯一的现行路线图。
>
> 状态依据：截至 2026-07-24 的 `main` 分支代码、测试与提交记录。
>
> 状态只使用：`未开始`、`进行中`、`阻塞`、`已完成`。

## 项目目标

CloudMind 要交付一个可自行部署、数据由个人掌控的 AI 记忆层。采集、检索、
知识图谱、记忆生命周期、Web 管理、数据主权和稳定发布已经形成闭环。v0.3.0
是当前可验证基线，下一轮里程碑等待真实使用反馈后立项。

## 里程碑

| 里程碑 | 目标 | 状态 | 依赖 | 模块文档 | 退出标准 |
| --- | --- | --- | --- | --- | --- |
| [M0](#m0-采集与异步处理) | 打通 URL、文本、PDF 的采集与异步处理闭环 | 已完成 | 无 | [采集与异步处理](模块设计/采集与异步处理.md) | 三类内容可创建资产、进入工作流、生成派生产物，并支持失败重试 |
| [M1](#m1-检索与问答) | 建立可度量、可降级的混合检索与来源感知问答 | 已完成 | M0 | [检索与记忆处理](模块设计/检索与记忆处理.md) | FTS5、Vectorize、图召回、融合、重排、MMR 和离线 eval 全部可运行 |
| [M2](#m2-知识图谱与记忆整合) | 建立可追溯、可调和的 L2 双时间知识图谱 | 已完成 | M0、M1 | [知识图谱与记忆整合](模块设计/知识图谱与记忆整合.md) | entities、statements、edges、provenance 可从采集流程写入，能指回 L1 来源，并可参与检索和定时修复 |
| [M3](#m3-agent-记忆面) | 建立按记录类型、记忆域和项目上下文自由组合的记忆生命周期 | 已完成 | M1、M2、M6 阶段 A | [Agent 记忆面](模块设计/Agent记忆面.md) | `recordKind × scopeId × contextKey` 贯穿写入和检索，专用更新/遗忘与 Agent Web 可用，并通过组合过滤和项目隔离验证 |
| [M4](#m4-web-访问与管理) | 完成 Observatory Web 工作台与主要管理路径 | 已完成 | M0、M1、M2 | [Web 访问与管理](模块设计/Web访问与管理.md) | 首页、资产、采集、搜索、问答、记忆区和 Activity 均接入真实数据 |
| [M6](#m6-数据主权与生命周期) | 兑现不可变原始快照、完整导出和可重建的数据主权 | 已完成 | 阶段 A：M0；阶段 B：M3 | [数据主权与生命周期](模块设计/数据主权与生命周期.md) | 文本、MCP 与 Agent 输入先有不可变快照；随后整库数据和 R2 文件可校验导出、导入与重建，遗忘后的跨存储状态一致 |
| [M7](#m7-工程质量与发布) | 把本地门禁扩展为开发前置保障和可重复发布 | 已完成 | 贯穿已交付里程碑 | [工程质量与发布](模块设计/工程质量与发布.md) | 前置 CI 与 Cloudflare 集成门禁持续通过，并完成一次带迁移、回滚和生产冒烟的可复现发布 |
| [M8](#m8-开源产品入口) | 建立可独立静态托管的 CloudMind 开源产品入口 | 已完成 | M4、M6、M7 | [开源产品入口](模块设计/开源产品入口.md) | 桌面与手机布局可用，产品边界与部署入口准确，并通过静态检查和项目门禁 |

原 M5 高级记忆模态已移出当前计划；M6、M7 保留原编号，避免提交和文档引用漂移。

## M8 开源产品入口

基于真实用户反馈新增独立 `web/` 静态落地页。它负责让开源用户在进入管理工作台前理解
CloudMind 的 BYOC、数据主权和三层记忆模型，并统一导向仓库内维护的部署说明。

完成依据：2026-07-27 已完成 Edge 1440px / 390px 响应式检查、移动导航与个人 / Agent
记忆切换交互检查；`pnpm gate` 通过，落地页交付提交为 `79642d9`。

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
恢复；两个都含 `M1/M2` 的项目已通过本地 D1/FTS/L2 Workers 测试和生产
D1/FTS/Vectorize/L2 隔离验收。验收数据最终为 2 条已遗忘、0 条活跃、0 条残留 chunk
向量。用户如需归档完整会话，显式保存为 library 资产；通用资产 CRUD 不计作记忆
生命周期能力。

完成依据：`adb59ba`、`6d4a5b2`、`bc01613`，Quality Gate `30072228441`、Cloudflare
Workers Build `561054ec-fe44-4d08-aa40-31d2eccd0f87` 和生产项目隔离验收。

## M4 Web 访问与管理

Observatory 设计系统、App Shell 和真实数据页面已经落地，覆盖 Overview、
Library、Asset Detail、Capture、Ask、Search、记忆图谱、时间线、整合和 Activity。

完成依据：`27e1b66` 至 `d2423ae` 的分阶段前端提交和构建门禁。

边界说明：M4 已交付通用 Web 工作台和只读的 personal 记忆视图；Agent 记忆管理页
随 M3 的生命周期能力交付，由 M4 提供页面组件和交互入口。

## M6 数据主权与生命周期

本里程碑分两个阶段。阶段 A 已完成：文本、MCP 和 Agent 输入会先保存不可变 R2
原始快照，再进入清洗、摘要、图谱和索引处理；重试可恢复“R2 已写、D1 尚未绑定”
的中断状态，已绑定快照禁止覆盖。阶段 B 的版本化整库数据包、离线校验、D1/R2/
Vectorize 恢复、可审计硬删除和 fresh-resource 真实演练均已完成。生产验收确认
memory 版本链可跨 D1/R2/Vectorize 完整清理；数据包 v2 在全新隔离资源中恢复 15 张
业务表、24 个 R2 对象和 24/114 条两类向量，FTS、外键与 3 个项目过滤全部通过。

完成依据：`5381288`、`16ef9f5`、Quality Gate `30078529580`，以及 2026-07-24
生产 hard delete 与数据包 v2 fresh-resource 恢复验收。

## M7 工程质量与发布

开发前置门禁已落地：GitHub Actions 与本地统一执行 `pnpm gate`，覆盖 Cloudflare
绑定类型漂移、密钥配置边界、Queue 原子认领/失败重投/DLQ，以及 Miniflare 中的
真实 D1 migrations 和 Queue ack/retry。发布收尾实现已落地：v0.3.0、CHANGELOG、
远端 migration 精确核验、生产冒烟、失败自动回滚、手动回滚和回滚演练均有统一脚本；
Cloudflare Workers Builds 的生产 Trigger 已接入该流程。`ad50200` 的真实自动发布
完成 19 个远端 migration 核验、Worker 部署和三项生产冒烟；随后生产从
`d79ab361` 回滚到 `f1c09fb8` 并恢复 `d79ab361`，两次冒烟均通过。

完成依据：`ad50200`、Quality Gate `30104398954`、Cloudflare Workers Build
`9488add2-fe3d-4326-a52a-99506a1c710c`，以及 2026-07-24 生产回滚演练。

## 当前推进顺序

现行 roadmap 的里程碑均已完成；新增目标进入下一轮规划。

## 历史路线图

以下文件只保留历史计划和决策背景，不再承载当前状态：

- [记忆层实施 Roadmap v2](roadmap-archive/memory-layer-roadmap-v2.md)
- [高级记忆模态设想](roadmap-archive/高级记忆模态.md)
- [前端改造 Roadmap](roadmap-archive/frontend-rebuild-roadmap.md)
- [代码质量优化 Roadmap](roadmap-archive/code-quality-roadmap.md)

更新项目进度时只修改本文；实现细节、验证方式和改动历史写入对应模块文档。
