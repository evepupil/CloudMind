# CloudMind 记忆层架构设计（私有化自托管 · 对标 mem0 / Zep / Letta / Cognee）

> 状态：现行设计 v2 · 2026-07-24
> 定位变更：本文档将 CloudMind 从"自称记忆层的 RAG"正式升级为**大而完备、个人私有化部署的 AI 记忆层**。
> 注意：本设计**有意反转** `AGENTS.md` 的两条既有立场（见文末决策记录 ADR-001）。

---

## 〇、目标与定位

CloudMind 的目标是做一个**真正的、完备的 AI 记忆层**，能力对标 mem0 / Zep-Graphiti / Letta(MemGPT) / Cognee；但与它们的根本区别在于：

> **它们都是 SaaS-first；CloudMind 主打"跑在你自己的 Cloudflare 账户里、零外部依赖、可整库导出"的私有记忆层。**

这不是功能差异，是范式差异——数据主权 + 个人长期记忆。我们相信**个人私有的云记忆层会成为主流**，CloudMind 的 BYOC 底子正是承载它的工程基础。

---

## 一、设计原则（5 条铁律，贯穿全栈）

| 原则 | 含义 |
|---|---|
| **数据主权** | 全栈在用户 Cloudflare 账户内：D1 / R2 / Vectorize / Queues / Cron / Workers AI。**无外部记忆 SaaS、无托管图数据库。** |
| **非损可导出** | L1 原始层永不被改写/丢弃，随时整库导出——BYOC 的真兑现 |
| **分层不耦合** | 记忆可进化/遗忘，绝不污染事实之源 |
| **图在 D1** | 知识图谱用 D1 邻接表 + 递归 CTE，不引 Neo4j |
| **单租户优先** | 个人私有不背多租户包袱，但预留 `scope` 维度给"多 agent / 多设备同步" |

---

## 二、当前实现与保留方向

截至 2026-07-24，检索地基、L2 图谱、M3 记忆生命周期和 M6 数据主权已经完成。
高级相对时间、评价、聚合、手动强化和显式建边已退出当前 roadmap，只保留为
真实使用需求驱动的候选方向。

| 轴 | 已实现 | 未来候选 |
|---|---|---|
| 写入模型 | `remember`、`remember_agent`、版本化更新、遗忘和恢复 | 按真实反馈扩展 |
| 记忆单元 | chunks、entities、statements、edges、provenance；episode 已移除 | community 收益验证 |
| 时间维度 | 日期范围、recency、显著性衰减、双时间事实和版本历史 | 相对事件锚定 |
| 结构 | 实体抽取、关系边、调和、图召回、三维过滤和项目视图 | 手动建边 |
| 反馈 | importance、age、accessCount 排序和自动访问回写 | 评价、聚合和手动强化 |

### 已完成的检索地基

- 结构化切块保留段落边界，检索使用 dense、FTS5/BM25 和图召回三路输入。
- 跨通道结果经过 RRF、Workers AI reranker 和 MMR，不再直接比较不同量纲的原始分数。
- FTS5 trigram 支持中文词面召回，Vectorize 使用原生 metadata 过滤。
- 25 条离线查询形成持续门禁；当前里程碑状态和指标以
  [`docs/roadmap.md`](roadmap.md) 为准。

### 平台事实（团队曾低估，已核实）

| 团队以为做不到 | 真相 |
|---|---|
| Vectorize 不能原生过滤 | ❌ **支持** metadata 过滤（topK 前生效）；现有 1/3/6/12 overfetch + 240 召回天花板是自找的 |
| Workers AI 没有 reranker | ❌ `@cf/baai/bge-reranker-base` 自 2025-03 在目录，跑现有 `AI` binding，比 embedding 还便宜 |
| LIKE 是唯一 lexical 手段 | ❌ D1 **原生支持 FTS5/BM25**，trigram tokenizer 能处理中文 |
| 得换更好的 embedding | ❌ `@cf/baai/bge-m3` 本来就对（多语言、~60K context）；只需加 query/passage instruction prefix（现在 `purpose` 是 no-op） |
| 没托管图库做不了 KG | ❌ D1 邻接表 + 递归 CTE + Vectorize 即"边缘原生知识图谱" |

---

## 三、对标速览：各家最强的一招

| 项目 | 核心机制 | 借鉴 |
|---|---|---|
| **mem0** | LLM 抽事实 → 检索相似 → 判 **ADD/UPDATE/DELETE/NOOP**；mem0g 内建实体链接 | 智能写路径（调和而非堆积）+ 内建实体链接 |
| **Zep/Graphiti** | 三子图 **Episode/Entity/Community**；边带 **bi-temporal**（事件时+录入时），冲突**置失效不删** | 双时间有效期与可追溯来源；CloudMind 不采用 Episode 子图 |
| **Letta/MemGPT** | OS 式 **Core/Recall/Archival** 分层；工具**自编辑**；**sleep-time** 空闲整理 | L3 工作记忆 + 自编辑动词 + sleep-time 整合 |
| **Cognee** | **ECL**(Extract→Cognify→Load)；万物皆 **DataPoint**；图↔向量恒绑定 | 统一管线 + 节点恒带 embedding |

> 四家其实是同一套骨架的不同侧重：**原始/语义分层 + 实体图 + 双时间 + 智能写 + 整合 + 混合检索 + 自编辑面**。CloudMind 首次把它完整搬到个人自托管的 Cloudflare 上。

---

## 四、三层架构总览

```
┌─ L3 工作 & 记忆面 ────────────────────────────────────────┐
│ MCP 记忆动词(remember/recall/update/forget/restore)        │
│ 混合+图检索管线 · context scope · sleep-time 整合/遗忘 job  │
├─ L2 语义记忆层(新增·可变·带时间与显著性·完整知识图谱) ─────┤
│ entities(节点) · statements/facts(bi-temporal) · edges(关系)│
│ provenance(→L1) · communities/insights(整合摘要)           │
├─ L1 来源层(瘦身·不可变·可导出·真相之源) ─────────────────┤
│ assets(library|memory) · chunks(检索/取证) · R2 原始快照    │
└────────────────────────────────────────────────────────────┘
  对位：L1=可移植原始来源 · L2=Zep Entity+Community / mem0g · L3=Letta tiers
```

契约（最关键的一根线）：
```
写入：doc 导入 / agent remember → 落 L1 事实(不可变,有源)
                                  → 凝结/更新 L2 记忆(可变,带时间显著性,指回 L1)
读取：recall → 读 L2(相关性×新近×显著 排序) → 钻取 L1 取证据/引用
矛盾：在 L2 置失效(bi-temporal)，L1 原始记录永不丢
性质：记忆会答、事实能证；改变信念不以销毁源为代价
```

---

## 五、L1 来源层（瘦身 + 三维记录模型）

**问题**：现在 L1（asset）太重，塞了大量 L2 的派生字段。**语义/派生一律上移**，L1 回归"被捕获的客观事实"。

| 关注点 | 现在错放在哪 | 应归属 |
|---|---|---|
| domain / documentClass / topics / tags | asset 列 + descriptorJson | **L2**（记忆的派生属性/实体标签） |
| sensitivity / aiVisibility / retrievalPriority | asset 列 | **L2 显著性** + **L3 访问 scope** |
| facets | asset_facets | **L2**（实体/标签链接） |
| assertions | asset_assertions | **L2 statements**（升级为主谓宾 + 双时间 + 出处） |

瘦身后：
```
assets (L1)
  id, type(text|url|pdf|chat), record_kind(library|memory), title_raw,
  source_kind, source_url, source_host, captured_at,
  raw_r2_key, content_r2_key, content_hash,
  scope_id(personal|agent), context_key(global|project:<stable-key>), deleted_at
  ── 移除: domain/documentClass/sensitivity/retrievalPriority/descriptorJson/facets/assertions

chunks (L1, 保留) — 仍是检索/取证最小片段；embedding 元数据增强见 P1
```

核心三维互相独立：`record_kind` 说明资料或记忆，`scope_id` 说明用户明确保存或
Agent 主动保存，`context_key` 说明全局或项目上下文。三个维度贯穿 D1、FTS、
Vectorize metadata 和 L2 隔离条件。

完整会话不自动进入 L1。Agent 只保存选中的高密度 memory；用户显式归档会话时，
它作为 library 资产保存。任何时候导出 L1 都能得到全部显式资料和记忆，L2 可重建。

---

## 六、L2 语义记忆层 —— 完整知识图谱（决策：见 ADR-001）

**已决策做完整知识图谱**：entities + edges + 多跳遍历，节点恒带向量。

```
entities            id, scope_id, context_key, canonical_name, normalized_name, type,
                    embedding_vector_id, salience, mention_count,
                    first_seen_at, last_seen_at, aliases_json

statements(facts)   id, scope_id, context_key, subject_entity_id, predicate,
                    object_entity_id | object_literal, nl_text, embedding_vector_id,
                    confidence, importance,
                    valid_from, valid_until,      -- 事件时：世界为真区间
                    created_at, expired_at,        -- 录入时：系统相信区间
                    superseded_by_id, last_accessed_at, access_count

edges               id, scope_id, context_key, src_entity_id, dst_entity_id, relation,
                    valid_from, valid_until, created_at, expired_at, weight, confidence

provenance          memory_id(stmt|entity|edge), asset_id, chunk_index, span

communities         id, scope_id, context_key, member_entity_ids_json, summary,
                    summary_vector_id, refreshed_at
```

对标点：
- `statements/edges` 的**双时间四字段** = Graphiti（冲突→置 `expired_at` 失效，不删）
- `subject-predicate-object` = mem0g 有向标注图
- `provenance` 直接指向 asset/chunk（**每条记忆都能溯回 L1 证据**）
- `communities` = Zep 社区 / mem0 摘要
- 每个节点 `embedding_vector_id` = Cognee 图↔向量恒绑定

多跳召回 = D1 递归 CTE 在 `edges` 上遍历（深度限 2-3 跳控延迟）。实体消歧复用现成 `metadata_terms` 向量 + 0.86/0.72 阈值机制（新 `graph_entities` namespace）。

---

## 七、写路径：智能写（ECL + mem0 调和 + Graphiti 双时间）

doc 导入与 agent remember 走同一条管线，仅入口不同：
```
1 Extract   写 L1 asset(瘦) + immutable snapshot + chunks （非损、立刻有源）
2 Cognify   Workers AI 抽 entities + statements(SPO)       （激活死着的 extract_entities 步骤）
3 Resolve   每个实体/事实 embed → Vectorize ANN 找相似      （复用 0.86/0.72 阈值）
4 Reconcile LLM 判 ADD/UPDATE/DELETE/NOOP                  （mem0；矛盾→置 expired_at 失效）
5 Load      写 L2 + provenance 指回 L1                      （图↔向量同写，按 content_hash 幂等去重）
```
关键：**第 4 步是"记忆 vs 文档库"的分水岭**。D1+Vectorize 非事务 → 第 5 步做成**幂等调和**，可被 sleep-time job 重放修复。

---

## 八、读路径：混合 + 图检索（Zep 三路融合的 Cloudflare 版）

```
query → 并行召回:
   ① 向量(Vectorize, 原生 metadata 过滤)   — 语义
   ② BM25(D1 FTS5 trigram)                — 中文/词面
   ③ 图遍历(D1 递归 CTE, 1-2 跳)           — 关联/多跳
        ↓ RRF 融合(rank-based, 量纲无关)
        ↓ bge-reranker-base 交叉编码重排 + MMR 去重
        ↓ 显著性加权: relevance × exp(-λ·age) × importance × log(1+access)
   → 读 L2 记忆(排序好) → 钻取 L1 取原文引用
   → 命中即经 Queue 异步 bump last_accessed/access_count（写回闭环）
```
这条管线**同时是地基(P1)和记忆读路径**——检索修复是 L2/L3 的承重墙，不是额外项。

---

## 九、Sleep-time 整合 / 遗忘（Letta 空闲计算 + Cron）

Cloudflare **Cron Trigger + Queue/Workflows** 跑后台"睡眠期"维护：
- **整合**：近重复 statement 合并、社区聚类 + 生成 community summary、summary-of-summaries
- **遗忘**：低 importance × 长期未访问 → 衰减/归档（隐私感知遗忘）
- **修复**：重放未完成调和、补 provenance、修图↔向量漂移

---

## 十、L3 记忆面：自编辑动词（Letta 工具化 + 现成 MCP 管道）

当前 MCP 工具平铺注册，覆盖知识库、记忆和运维能力。专用记忆生命周期动词已经
接入，并复用 `withToolLogging`、token 鉴权和 context profiles 管道：

| 动词 | 语义 | 复用 |
|---|---|---|
| `remember(text, context?)` | 写 `memory + personal`，再抽取、调和 | 复用文本管线 |
| `remember_agent(text, context?)` | 写 `memory + agent`，再抽取、调和 | 复用文本管线 |
| `recall(queries, filters)` | 通过混合检索读 L2 并引用 L1 | 复用检索主干 |
| `update_memory(id, patch)` | 新建版本并让旧版本失效 | 专用生命周期服务 |
| `forget(id, scope, context, hard?)` | 默认软删；硬删同时清理版本链和派生数据 | 专用生命周期服务 |
| `restore_memory(id)` | 从不可变快照恢复并重建派生数据 | 专用生命周期服务 |

`record_kind × scope_id × context_key` 贯穿三层。查询支持维度内 OR、维度间 AND，
省略某个维度表示不限制；客户端调用 `recall_agent` 时显式传当前项目 context，
并允许 personal 与 agent 两个 scope。省略 context 只保留兼容期的 global 行为。

---

## 十一、全自托管映射（每块都落在 Cloudflare，无外部依赖）

| 能力 | 标杆通常用 | CloudMind 私有方案 |
|---|---|---|
| 原始资料/记忆存储 | S3 / Postgres | **R2 + D1** |
| 知识图谱 | Neo4j / FalkorDB | **D1 邻接表 + 递归 CTE** |
| 向量 | Pinecone / Qdrant | **Vectorize**（原生过滤） |
| 词面检索 | Elasticsearch | **D1 FTS5 + trigram** |
| 重排 | Cohere / 外部 reranker | **Workers AI `bge-reranker-base`** |
| LLM 抽取/调和 | OpenAI | **Workers AI（`qwen3-30b`）** |
| 后台整合 | Celery / 常驻 worker | **Cron Trigger + Queues / Workflows** |

> 标杆要拼 5-6 个外部服务才能跑的记忆层，CloudMind 用一个 Cloudflare 账户就能私有化全包——这就是"个人私有云记忆层"成立的工程基础。

---

## 十二、分阶段路线图（增量交付，不 big-bang 重写）

> 本节保留记忆层的架构分期。项目当前状态、跨模块依赖与后续顺序统一以
> [`docs/roadmap.md`](roadmap.md) 为准。

| 阶段 | 主题 | 主要内容 | 产出 |
|---|---|---|---|
| **P1 地基** | 检索可信 | 结构/token 切块、RRF 融合、bge-reranker 重排、FTS5 中文、Vectorize 原生过滤、bge-m3 prefix、3 个 bug、最小 eval harness | 真正好用的私有 RAG/搜索 |
| **P2 分层** | 事实/记忆分离 | L1 瘦身迁移、建 L2 表(entities/statements/edges/provenance/communities)、激活 `extract_entities` | 数据干净，骨架就位 |
| **P3 心脏** | 真记忆 | 智能写(调和+双时间)、图检索融入读路径、显著性/衰减、sleep-time 整合/遗忘 | 名副其实的记忆层 |
| **P4 面** | agent-native | 三维记录模型、项目隔离、记忆动词 MCP、Agent Web | 私有记忆基础设施 |

依赖：每阶段独立可发布；**P1 的 re-embed 必须先于 P2 的迁移**，避免重嵌两遍。

### P1 检索质量基线（eval 棘轮，2026-07-22 校准）

`npm run eval` 离线确定性跑 25 条金标准（含 8 条 CJK、2 条过滤正确性、3 条多样性/多相关），按四个管线阶段分别度量，使各阶段贡献可归因、回归可定位。离线 embedder 是 token-hash 确定性替身，故本 eval 是排序**接线的回归门禁**，非语义质量绝对证明（语义增益靠真环境冒烟）。

| 阶段 | Recall@10 | MRR | nDCG@10 | MAP |
|---|---|---|---|---|
| lexical（仅词面） | 1.0000 | 0.9800 | 0.9811 | 0.9700 |
| dense（仅向量） | 1.0000 | 0.9600 | 0.9705 | 0.9600 |
| fused（跨通道融合·T6） | 1.0000 | 0.9600 | 0.9624 | 0.9433 |
| **reranked（融合+重排+MMR·T7）** | **1.0000** | **0.7667** | **0.8292** | **0.7667** |

- Wave B 删除 assertion / term 通道后，每个资产只剩 1–2 条证据；离线 token-hash reranker 的噪声会把部分第一名下移。该替身只验证接线、召回不丢失和过滤零违例，真实排序质量仍由生产 `bge-reranker-base` 冒烟验证。
- 棘轮锁在 Wave B 后 reranked 实测下界（Recall@10=1.0 / MRR≥0.76 / nDCG@10≥0.82 / MAP≥0.76），并要求过滤正确性零违例。
- P2+ 任何检索改动若把 reranked 指标拉低于此即 CI 报红。

---

## 十三、决策记录（ADR）

### ADR-001：L2 采用完整知识图谱（2026-06-05，已定）
- **决策**：L2 做 entities + edges + 多跳遍历的**完整知识图谱**，而非轻量"带关系的事实集"。
- **影响**：**有意反转** `AGENTS.md` 两条立场——
  - 第 51 行"当前明确不做：自动实体对齐/复杂知识合并" → 现纳入范围（P3 核心）。
  - 第 42 行"先做可用采集，再做复杂知识图谱" → 升级为正式目标。
- **代价**：实体消歧 + 矛盾检测是 AI 质量依赖的真难点，成本与失败面上升；以幂等调和 + bi-temporal 失效 + 严格 JSON schema 校验兜底。
- **执行**：已同步更新 `AGENTS.md`（及镜像 `CLAUDE.md`），标注两条旧立场为 superseded。

### ADR-002：检索修复(P1)为全计划承重墙（已定）
- 没有 P1，L2/L3 都建在烂召回上，记忆层在协议层照塌。P1 不可跳过、且先行。

### ADR-003：L1 迁移采用"新库重来"（2026-06-05，已定）
- **决策**：不写历史数据迁移脚本；私有部署、数据量小，直接以瘦身后的新 schema 重建库。
- **影响**：P2 落地更干脆，无需兼容旧 asset 行；现有部署需重新 ingest（原始资产仍可从 R2 重放）。

### ADR-004：记录采用三个正交维度（2026-07-24，已定）
- **决策**：`record_kind(library|memory)`、`scope_id(personal|agent)`、
  `context_key(global|project:<stable-key>)` 贯穿写入、检索、向量和图谱。
- **理由**：记录形态、记忆来源域和项目上下文各自只表达一件事，调用方可以自由
  组合过滤，并阻止不同项目的同名里程碑和实体互相污染。

### ADR-005：移除 episode 与自动会话原文捕获（2026-07-24，已定）
- **决策**：目标 schema 删除 episodes 和 provenance.episode_id；L2 出处直接指向
  asset/chunk。CloudMind 默认不保存完整外部会话，也不提供 capture_episode。
- **理由**：asset + immutable R2 snapshot 已承载原始来源；agent_assert 与 memory
  重复，correction 由版本更新表达，chat_turn 会扩大噪声、成本和隐私面。
- **迁移**：先重建 provenance 并保留 asset_id/chunk_index，再删除 episode 外键与
  表，避免级联删除现有出处。

---

## 十四、待定问题（Open Questions）

1. ~~**L1 迁移方式**~~ → **已定（ADR-003）**：新库重来，不写迁移脚本。
2. ~~**下一步详设展开**~~ → **已定**：M3 与 M6 已完成，当前进入 M7 发布收尾。
3. ~~**记录过滤维度**~~ → **已定（ADR-004）**：record kind、scope、context 三维。
4. ~~**AGENTS.md 是否更新**~~ → **已完成**：AGENTS.md（及镜像 CLAUDE.md）已记录方向升级并标注 superseded 旧立场。

---

## P1 运维 runbook（一次性，部署/重建时执行）

P1-T4 起，检索改用 **Vectorize 原生 metadata 过滤**（在 ANN topK 之前生效），删除了旧的 1/3/6/12 overfetch 阶梯与 240 召回天花板。由于 **metadata 索引必须在 upsert 向量之前声明**、且变更需重建索引，需在部署或 fresh rebuild（ADR-003）时一次性执行：

1. 重建 Vectorize 索引：`wrangler vectorize create cloudmind-asset-chunks --dimensions=1024 --metric=cosine`
2. 为可过滤字段创建 string metadata 索引（共 7 个）：`aiVisibility / domain / sourceKind / sourceHost / collectionKey / type / scopeId`——完整命令见 `wrangler.jsonc` 注释。（Wave B L1 瘦身已移除 `documentClass`。）
3. 全量 re-ingest / reprocess，写入带 metadata 的 chunk 向量（**旧向量缺 metadata 会被原生过滤排除**，故必须重灌）。

> 本地无真 Vectorize，T4 的适配器与 service 逻辑由单测覆盖（过滤条件下推 Vectorize、单次查询无阶梯），端到端需部署后验证。topic/tag/日期等多值/范围过滤仍由 D1 join 兜底。

---

## 参考资料（对标项目）

- mem0 — [Memory Operations (DeepWiki)](https://deepwiki.com/mem0ai/mem0/3.3-history-and-storage-management) · [State of AI Agent Memory 2026](https://mem0.ai/blog/state-of-ai-agent-memory-2026)
- Zep/Graphiti — [A Temporal Knowledge Graph Architecture (arXiv 2501.13956)](https://arxiv.org/html/2501.13956v1)
- Letta/MemGPT — [Letta 文档](https://docs.letta.com/concepts/letta/) · [Stateful AI Agents deep dive](https://medium.com/@piyush.jhamb4u/stateful-ai-agents-a-deep-dive-into-letta-memgpt-memory-models-a2ffc01a7ea1)
- Cognee — [How Cognee Builds AI Memory](https://www.cognee.ai/blog/fundamentals/how-cognee-builds-ai-memory)
