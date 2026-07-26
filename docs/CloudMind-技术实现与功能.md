# CloudMind 技术实现与功能

CloudMind 当前发布版本为 v0.3.0。它是一个可以部署到个人 Cloudflare 账号中的
AI 记忆层，提供资料采集、语义处理、知识图谱、混合检索、来源感知问答、个人与
Agent 记忆管理，以及完整的数据导出和恢复能力。

项目采用 BYOC（Bring Your Own Cloud）方式交付。D1、R2、Vectorize、Queues、
Workers AI 和 Worker 都属于部署者自己的 Cloudflare 账号，运行过程中不依赖外部
记忆 SaaS 或托管图数据库。

## 当前功能

CloudMind 的使用入口分为 Web、REST API 和 MCP 三类。

在 Web 工作台中，可以保存网页、文本和 PDF，查看资产正文、摘要、标签、处理状态
和来源；可以进行关键词、语义和图谱联合搜索，也可以基于已保存资料进行带来源的
问答。记忆区提供知识图谱、时间线、整合状态和 Agent 记忆控制台。Activity 页面集中
展示异步任务和失败信息。

MCP 面向 Codex、Claude Code、Cursor 等支持 MCP 的 AI 客户端。v0.3.0 共提供 20 个
工具，主要分为以下几组：

| 能力 | 工具 |
| --- | --- |
| 个人记忆 | `remember`、`recall`、`update_memory`、`forget`、`restore_memory` |
| Agent 记忆 | `remember_agent`、`recall_agent` |
| 资料库 | `save_asset`、`list_assets`、`search_assets`、`get_asset`、`ask_library` 等 |
| 资产管理 | 更新、删除、恢复和重新处理资产 |
| 运维 | 查询资产工作流和具体运行记录 |

AI 客户端可以在任务开始时召回项目历史，在完成一个长期有用的决策、进度或结果后
写入简短记忆。CloudMind 默认只接收经过选择的高密度记忆。完整对话需要用户明确
归档，归档后作为资料资产进入统一处理流程。

## 三层数据模型

CloudMind 将数据拆成 L1 来源层、L2 语义记忆层和 L3 记忆面。

```text
L3 记忆面
  Web 管理 + MCP 记忆动词 + 混合检索 + 定时维护

L2 语义记忆层
  entities + statements + edges + provenance

L1 来源层
  assets + chunks + R2 不可变原始快照
```

L1 保存用户真正提交过的内容。资产元数据和切块记录位于 D1，原始网页、文本和 PDF
位于 R2。这里是可导出、可校验的事实来源。摘要、实体、关系和向量都属于派生数据，
发生模型升级或索引损坏时可以从 L1 重建。

L2 保存从来源中提取出来的语义结构。实体使用 `entities` 表，事实使用
`statements` 表，实体之间的关系使用 `edges` 表。每条语义记忆通过 `provenance`
指回具体资产和 chunk，检索结果可以继续下钻到原始证据。

L3 提供外部可操作的记忆能力，包括写入、召回、更新、遗忘、恢复、问答和 Web
管理。协议层使用 MCP，AI 客户端不需要了解 D1、R2 或 Vectorize 的存储细节。

这种分层允许语义记忆持续变化，同时保留最初输入。系统可以将一条旧事实标记为
失效，也能说明旧结论来自哪份材料、何时被新结论取代。

## 采集与异步处理

文本、URL 和 PDF 分别进入 `note_ingest_v1`、`url_ingest_v1` 和
`pdf_ingest_v1` 三条类型化工作流。入口不同，清洗、分块、摘要、embedding、图谱
提取和索引等公共步骤由同一套 workflow 组件编排。

```text
Web / REST / MCP
  -> 创建 D1 asset
  -> 保存 R2 原始快照
  -> 投递 Cloudflare Queue
  -> 清洗、摘要、分类、分块
  -> embedding、知识抽取、索引
  -> ready 或 failed
```

原始快照在任何 AI 派生处理之前保存。文本固定写入独立的 R2 key；URL 重处理读取
第一次抓取的快照，不会再次请求可能已经变化的网页；PDF 同样保留原始文件。清洗只
作用于工作副本，首尾空格和换行等原始字节仍留在 R2 中。

工作流为每个步骤记录状态和错误。Queue 消费者通过 D1 条件更新原子认领任务，重复
消息不会重复执行已经完成的步骤。失败消息会重投，超过重试次数后进入 DLQ。即使
R2 已写入而 D1 指针绑定暂时失败，下一次执行也会识别固定对象并继续完成绑定。

业务层只依赖 `AssetRepository`、`BlobStore`、`VectorStore`、`JobQueue` 和
`AIProvider` 等接口。D1、R2、Vectorize、Queues 和 Workers AI 的实现集中在
platform 层，后续替换 PostgreSQL、S3 兼容存储或其他模型提供方时，核心工作流不必
整体重写。

## 语义记忆与知识图谱

内容完成清洗和切块后，Workers AI 从中提取实体、陈述和关系。CloudMind 在 D1 中
使用邻接表保存知识图谱，在 Vectorize 中保存实体和陈述的向量。图遍历由 D1 递归
CTE 完成，因此私有部署无需再维护 Neo4j 一类独立图数据库。

新事实写入前会在相同记忆域和项目上下文中查找相近实体与已有陈述，然后进行四种
调和判断：

| 动作 | 含义 |
| --- | --- |
| `ADD` | 新信息，写入新的陈述 |
| `UPDATE` | 同一属性出现新值，写入新陈述并让旧陈述失效 |
| `DELETE` | 新信息明确否定旧事实，让旧陈述失效 |
| `NOOP` | 已有事实能够表达同一信息，跳过重复写入 |

模型输出必须通过严格结构校验。结果不合法或模型调用失败时，系统采用保守的 ADD
处理，避免错误地让已有记忆失效。D1 与 Vectorize 之间没有跨服务事务，写入过程使用
稳定 ID 和幂等步骤处理重试，定时任务再修复重复陈述和漂移关系。

`statements` 同时记录事实在现实世界中的有效时间，以及系统何时接收、何时停止采用
这条事实。UPDATE 会保存新版本，并通过 `superseded_by_id` 连接旧版本；历史记录
仍然可查。这个双时间模型可以表达“某人从什么时候开始担任新职位”和“CloudMind
什么时候获知这次变化”两个不同问题。

每条陈述还会记录重要度、最近访问时间和访问次数。检索排序可以综合相关性、时间
衰减、重要度和访问强化。每日 Cron 只做幂等的一致性维护，不会根据年龄或访问频率
自动删除个人记忆。

## 混合检索与来源感知问答

一次查询会并行进入三个召回通道：

1. Vectorize 向量检索，用于寻找语义相近的 chunk。
2. D1 FTS5/BM25 词面检索，用于精确词语、专有名词和中文片段。
3. 知识图谱召回，从查询实体出发扩展一至两跳关系。

Vectorize 在近邻搜索前执行 metadata 过滤，FTS5 使用 trigram tokenizer 补足中文
没有天然空格分词的问题。三个通道的原始分数不在同一量纲，CloudMind 先使用 RRF
按名次融合，再调用 Workers AI 的 `bge-reranker-base` 交叉编码重排。最后通过 MMR
压制高度重复的片段，在相关性和证据多样性之间取得平衡。

```text
dense + lexical + graph
  -> RRF 融合
  -> Workers AI reranker
  -> MMR 去重
  -> 按资产组织 grouped evidence
  -> 搜索结果或带来源回答
```

证据最终按资产分组，搜索结果同时保留命中的 chunk、来源和排序信息。Ask 直接复用
Search 的完整召回链，只在回答阶段增加证据门槛、可见性处理和答案生成，避免搜索与
问答出现两套不同的召回行为。reranker 或生成模型失败时，已有证据仍可返回。

可见性支持 `allow`、`summary_only` 和 `deny`。`summary_only` 记录只把摘要交给
问答模型，原始正文继续保持不可见。缺少足够来源时，严格问答模式会返回证据不足，
不会用模型常识补出一段看似合理的个人历史。

项目包含 25 条确定性金标准查询，分别度量 lexical、dense、fused 和 reranked 四个
阶段，并要求过滤零违例。离线 embedding 和 reranker 使用确定性替身，这套 eval
主要防止检索接线和排序流程回归；真实模型的语义质量仍通过 Cloudflare 环境冒烟和
真实使用样本检查。

## 记录归属与项目隔离

每条资料或记忆都带有三个互相独立的维度：

```text
recordKind = library | memory
scopeId    = personal | agent
contextKey = global | project:<stable-key>
```

`recordKind` 区分资料和长期记忆，`scopeId` 区分用户明确保存的内容和 Agent 主动沉淀
的工作记忆，`contextKey` 区分全局信息与具体项目。项目 key 通常由规范化 Git remote
生成，例如 `project:github:evepupil/CloudMind`，从而避开本机路径变化。

三个维度贯穿 assets、chunks、D1 FTS、Vectorize metadata、实体消歧、陈述、关系和
来源。每个维度内部按 OR 组合，不同维度之间按 AND 组合。不同仓库都可能存在 M1、
M2、release 等同名实体，`scopeId + contextKey` 会阻止它们在实体合并、事实调和和
图召回时串到一起。

通用 Web 工作台显式读取 personal 数据，Agent 工作记忆集中在独立控制台中管理。
MCP 读取工具会返回实际应用的过滤条件，方便客户端检查查询范围。

## 更新、遗忘与恢复

`update_memory` 不会直接覆盖现有正文。系统先创建一个包含根版本 ID、版本号和前一
版本指针的候选版本，候选进入正常 Queue 工作流。只有新版本完成快照、分块、图谱和
索引处理后，D1 才在一个 batch 中激活新版本并将旧版本标记为 superseded。候选处理
失败时，旧版本仍然有效。

`forget` 默认执行软删除。D1 会立刻将目标排除出列表和检索，同时清理 chunk 向量。
`restore_memory` 从首次保存的不可变 R2 快照重新进入处理流水线，恢复 chunk、向量
和语义派生数据。更新、遗忘和恢复都要求精确的 `scopeId + contextKey`，避免跨项目
误操作。

永久删除需要目标已经处于软删除状态，并显式提交完全匹配的 `confirmId`。清理按照
R2、资产向量、图向量和 D1 的顺序幂等执行。若某个外部存储失败，资产会保持在不可
检索、不可恢复的 purge pending 状态，后续可以重试。共享 L2 实体或陈述仍有其他
来源时会被保留。

删除审计只记录不可逆目标哈希、数量、阶段错误码和时间，不保存正文、对象 key 或
明文目标 ID。这样可以证明清理过程发生过，同时减少审计记录本身泄露内容的风险。

## 数据导出与恢复

CloudMind 的数据主权包含原始数据、结构化数据和索引重建能力。`data:export` 会分页
导出 D1 业务表、D1 正式引用的 R2 对象，以及资产和图谱两个 Vectorize 索引，最终
生成带逐文件 SHA-256 的版本化清单。

`data:validate` 可以离线检查路径边界、文件大小、交叉引用和校验和。恢复命令只接受
显式命名的隔离资源，并在导入前检查目标和 Vectorize metadata 索引。随后依次应用
migrations、按外键顺序导入 D1、重建 FTS5、上传 R2 文件、写回向量，并核对表行数、
外键、对象和索引数量。

FTS5 属于可重建索引，因此导出包保存 `asset_chunks`，恢复时重新生成虚拟表。大文本
会按 UTF-8 边界切片写入，避免触发 D1 单条 SQL 大小限制。导出器以 D1 正式引用为准，
未绑定的 R2 孤立对象不进入恢复包。

v0.3.0 发布前已经进行过 fresh-resource 恢复演练：生产数据只读导出后，写入全新的
D1、R2 和两个 Vectorize 索引，再检查 FTS、外键、R2 哈希和三个项目的原生过滤。
这类演练验证的是数据包可以脱离原资源重建，覆盖范围超过只生成一份备份文件。

## Cloudflare 上的运行映射

| 需求 | CloudMind 实现 |
| --- | --- |
| 全栈应用和 API | HonoX + Hono，运行在 Cloudflare Workers |
| 结构化数据和知识图谱 | D1 + Drizzle ORM |
| 原始文件和不可变快照 | R2 |
| chunk 与图谱向量 | 两个 Vectorize 索引 |
| 中文词面检索 | D1 FTS5/BM25 + trigram |
| 异步处理 | Cloudflare Queues + DLQ |
| 摘要、抽取、embedding、重排 | Workers AI |
| 一致性维护 | Cron Trigger |
| Agent 接入 | Hono MCP + Streamable HTTP |

应用保持单个 HonoX 全栈项目，页面路由、REST API、MCP、Queue consumer 和 scheduled
handler 由同一个 Worker 入口注册。代码按 feature 划分，页面组件、服务端逻辑和领域
模型各自有明确边界。TypeScript 开启 strict，输入和模型输出使用 Zod 校验，D1 schema
和查询通过 Drizzle 管理。

## 工程门禁与发布

本地和 GitHub Actions 使用同一条 `pnpm gate`。门禁依次检查 Cloudflare 配置与密钥
边界、版本和 Changelog、TypeScript、Biome、Vitest、25 条检索 eval、生产构建、
Wrangler binding 类型，以及 Miniflare 中的 Workers 集成测试。

Workers 集成测试会应用真实 D1 migrations，覆盖 Queue ack/retry、任务原子认领、
memory 新旧版本切换和跨项目隔离。核心业务逻辑、repository 边界和纯函数使用 Vitest；
纯视觉调整通过构建和人工检查验证。

发布脚本先应用远端 D1 migrations，再精确核对 migration 名称和顺序，随后部署 Worker
并检查 health、登录页和未鉴权 MCP 请求。部署后冒烟失败时会恢复发布前的 Worker
version 并再次检查。D1 migration 只向前执行，因此 schema 修改采用 expand/contract，
确保迁移后的数据库可以同时被新旧两个 Worker 版本使用。

## 当前边界

CloudMind 当前以单用户私有部署为前提，没有多人权限和协作模型。图片 OCR、音视频
转录、community 自动聚类、手动建边和高级聚合仍在范围外。现阶段也不会自动捕获
外部 AI 的完整会话。

离线检索评测能够阻止工程回归，无法替代真实语料上的长期质量观察。知识抽取和事实
调和仍依赖模型质量，因此实现中保留了严格结构校验、保守降级、不可变来源和可追溯
版本。Cloudflare 原生方案减少了私有部署需要维护的服务数量，也意味着当前默认实现
依赖 Cloudflare 的 D1、R2、Vectorize、Queues 和 Workers AI；核心层接口已经为其他
数据库、对象存储、向量库和模型提供方保留替换边界。

项目地址：<https://github.com/evepupil/CloudMind>
