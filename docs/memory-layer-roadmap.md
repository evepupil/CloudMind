# CloudMind 记忆层实施 Roadmap

> 状态：可执行计划 v1 · 2026-06-05
> 设计依据：[`docs/memory-layer-architecture.md`](memory-layer-architecture.md)（本文档是它的**落地执行版**；改方向先改架构文档，再回填这里）
> 已锁定决策：**L2 = 完整知识图谱**(ADR-001) · **L1 = 新库重来**(ADR-003) · **MVP = 仅 default scope**(ADR-004) · **检索地基 P1 是承重墙**(ADR-002)
> 本 Roadmap 的任务清单由 P1–P4 + 横切五个方向对照真实代码生成，每条任务均标注改动文件与验收标准。

---

## 如何使用本文档

- 任务用 `- [ ]` 复选框，**按依赖顺序**推进；完成后勾选，并在 PR / commit 里引用任务号（如 `P1-T3`）。
- 每条任务含 **为什么 / 改动 / 验收**——验收过不了不算完成。
- 工作量标记：`S` = <0.5 天 · `M` = ~1–2 天 · `L` = >3 天。
- 全程铁律：**全 Cloudflare 自托管、无外部依赖**；L1 不写迁移脚本直接重建；`scope_id` 贯穿但 MVP 只用 `default`。

---

## 总览

| 阶段 | 主题 | 任务数 | 关键产出 | 依赖 |
|---|---|---|---|---|
| **P1** | 检索地基 | 10 | 结构切块 + RRF + bge-reranker + 中文 FTS5 + Vectorize 原生过滤 + eval harness；3 个 bug | — |
| **P2** | 分层（L1 瘦身 + L2 KG schema） | 11 | L1 瘦身、episodes、L2 entities/statements/edges/provenance/communities、fresh 迁移、激活 extract_entities | P1 |
| **P3** | 记忆心脏 | 9 | 智能写(ADD/UPDATE/DELETE/NOOP)+ bi-temporal + 显著性/衰减 + 图检索 + sleep-time 整合/遗忘 | P2, P1 |
| **P4** | 记忆面（MCP） | 8 | remember/recall/update/forget/reinforce/link + 快写路径 + 情节捕获 + scope | P2, P3 |
| **X** | 横切（贯穿全程） | 10 | eval 门禁、fresh 重建 playbook、测试、质量门禁、版本节奏、可观测、文档维护 | 贯穿 |

---

## 阶段依赖与推进顺序

```
        ┌─────────────────────────  X 横切（eval 门禁 / fresh 重建 / 测试 / 质量门禁 / 可观测）贯穿全程  ─────────────────────────┐
        │                                                                                                                      │
  P1 检索地基  ──(P1 re-embed 必须先完成)──▶  P2 分层(L1 瘦身 + L2 KG, fresh rebuild)  ──▶  P3 记忆心脏(智能写+时间+图)  ──▶  P4 记忆面(MCP 动词)
   承重墙(ADR-002)                              新库重来(ADR-003)                          复用 P1 检索管线                  复用 P2/P3 + 现成 MCP 管道
```

**关键约束**：
- **P1 先行且不可跳过**——P2/P3/P4 的 recall 质量全压在它上面（ADR-002）。
- **P1 的 re-embed 必须先于 P2 的 schema 重建**，否则要重嵌两遍。
- P2 是 **fresh rebuild**：drop & recreate D1 + 重建 Vectorize 索引（metadata 索引须在 upsert 前声明）。
- P3 依赖 P2 的 L2 表 + P1 的检索管线；P4 依赖 P2/P3，并复用现有 15 个 MCP 工具 + 鉴权管道。

---

## 建议里程碑与 tag 节奏（前辈可调）

| 里程碑 | = 完成 | 含义 | 建议 tag |
|---|---|---|---|
| 当前 | — | RAG 基线快照 | `v0.3`（已打，a89b712） |
| **M1** | P1 | 检索可信的私有 RAG/搜索 | `v0.4` |
| **M2** | P2 | 事实/记忆分层 + KG schema 就位 | `v0.5` |
| **M3** | P3 | 真·记忆层（智能写 + 时间 + 图） | `v0.6` |
| **M4** | P4 | agent-native 私有记忆基础设施 | `v0.7` |

> 横切（X）任务随对应阶段并行落地，不单独成里程碑。

---

## 下一步

从 **`P1-T0`（eval harness）** 开始——先把"好"变成可度量的，再动排序逻辑。需要时我可把任意一条任务展开成更细的实现指引或直接开工。

---

## P1 · 检索地基 / Retrieval Foundation

**目标**：Turn CloudMind's "RAG that calls itself a memory layer" into a trustworthy private retrieval engine: stop destroying document structure before chunking, replace cross-dimension score-sort fusion with rank-based RRF, add a bge-reranker-base cross-encoder + MMR stage behind the AIProvider port, light up a real CJK-capable D1 FTS5/BM25 lexical channel, push filters into Vectorize native metadata (dropping the over-fetch ladder/240 ceiling via a one-time index recreate aligned with the L1 fresh rebuild), make the bge-m3 query/passage instruction prefix actually fire, add embedding-model/dim + content_hash columns for incremental re-embed and migratability, fix the 3 retrieval/indexing bugs, and ship a golden-query eval harness so every change is measurable. P1 is the load-bearing wall (ADR-002) and its re-embed must precede the P2 migration (roadmap dependency line). MVP scope: default scope_id only (ADR-004); no L1 data migration script (ADR-003, fresh rebuild).

### 任务

- [x] **P1-T0 · Eval harness scaffold: golden query set + metrics runner (measure-before-change)** — `M` · 依赖: — ✅ 2026-06-05（基线 Recall@10=1.0000 MRR=0.9750 nDCG@10=0.9815 MAP=0.9750）
  - **为什么**：ADR-002 makes retrieval the承重墙; 'better' must be falsifiable before we touch ranking. Building the harness first (against the CURRENT pipeline) gives a baseline so every later task reports a delta instead of a vibe. Runs offline against the search service with mock AIProvider/VectorStore or a seeded local D1 so it has no Cloudflare dependency in CI.
  - **改动**：
    - tests/eval/golden/queries.jsonl — new: golden set of {query, lang(en|zh), expectedAssetIds[], note} covering CJK queries, multi-term, structure-sensitive (heading/list) cases, and the assertion-vs-chunk dimension-mismatch case from the doc
    - tests/eval/fixtures/corpus.ts — new: small deterministic in-memory corpus (assets+chunks+summaries+assertions+facets) seeded into a fake AssetSearchRepository
    - tests/eval/harness.ts — new: runs createSearchService(deps) over the golden set, computes Recall@k, MRR, nDCG@10, MAP per query and aggregate
    - tests/eval/eval.test.ts — new: vitest entry asserting metrics >= committed baseline thresholds (ratchet, not absolute)
    - package.json — add script "eval": "vitest run tests/eval" alongside existing test/typecheck
  - **验收**：
    - `npm run eval` runs with zero Cloudflare bindings and prints per-query + aggregate Recall@k / MRR / nDCG@10 / MAP
    - Baseline metrics for the CURRENT pipeline are recorded as the initial threshold in eval.test.ts (documented in the test as the pre-P1 baseline)
    - Golden set has >=20 queries including >=6 CJK queries and >=3 that target heading/list structure
    - Harness consumes the existing SearchServiceDependencies injection seam (no production code import cycles)

- [x] **P1-T1 · Stop whitespace-collapse before chunking; structural/token-aware chunker per asset type** — `M` · 依赖: P1-T0 ✅ 2026-06-05（结构保留清洗 + token 感知切块；7 个单元测试；eval 基线无回归。注：eval 跑预切块语料，切块质量由单元测试验证）
  - **为什么**：content-processing.ts normalizeContent and chunking.ts normalizeChunkText both run /\s+/ → ' ', flattening paragraphs/headings so chunking.ts findChunkBoundary's \n branch is dead code and chunks break mid-sentence (doc §2 first 🔴). shared-workflow-steps.ts createCleanContentStep also calls normalizeContent on raw content. Preserve structure; split per asset type (markdown/heading-aware for note/pdf text, list/line-aware) with token-budgeted windows + overlap.
  - **改动**：
    - src/features/ingest/server/content-processing.ts — split normalizeContent into a structure-preserving cleaner (collapse intra-line runs of spaces/tabs but KEEP newlines, paragraph breaks, list markers) used before chunking; keep a separate flatten() only for summary/preview generation (createTextSummary/createContentPreview)
    - src/features/ingest/server/chunking.ts — rewrite chunkAssetContent into structural+token-aware: split on heading/paragraph/list boundaries first, then pack into token-budgeted windows (approx token count, not raw chars) with sentence-safe overlap; accept an assetType hint
    - src/features/workflows/server/shared-workflow-steps.ts — createCleanContentStep: use the structure-preserving cleaner instead of normalizeContent so the \n boundaries survive into persist/chunk steps; thread assetType into chunkAssetContent via persistProcessedContent
    - src/features/ingest/server/content-processing.ts — persistProcessedContent: pass asset type to chunkAssetContent
    - tests/unit/features/ingest/server/content-processing.test.ts — assert newlines/headings survive cleaning; chunk boundaries land on structure, not mid-sentence
  - **验收**：
    - A markdown doc with headings + paragraphs yields chunks whose boundaries align to headings/paragraphs (no mid-sentence cuts) — covered by a unit test
    - normalizeContent no longer destroys \n before chunking; summary/preview paths still flatten
    - Chunk windows respect an approximate token budget with sentence-safe overlap; empty/whitespace-only input still returns []
    - Eval (P1-T0) Recall@k for the >=3 structure-targeting golden queries improves vs baseline

- [x] **P1-T2 · bge-m3 query/passage instruction prefix (fix the no-op purpose flag)** — `S` · 依赖: P1-T0 ✅ 2026-06-05（query 加指令前缀、passage 不变=无需重嵌；3 个 createEmbeddings 测试）
  - **为什么**：workers-ai-provider.ts createEmbeddings branches on input.purpose but both branches are identical (line 111: query→texts, else→texts.slice()) — the purpose flag is a no-op (doc §2 platform-facts row). bge-m3 benefits from asymmetric query vs passage instruction prefixes. Apply the prefix in the provider per purpose. This changes passage embeddings, so it must land WITH the re-embed (P1-T3) to avoid embedding twice (roadmap: P1 re-embed precedes P2).
  - **改动**：
    - src/platform/ai/workers-ai/workers-ai-provider.ts — apply distinct query vs passage instruction prefix to each text based on input.purpose before this.ai.run(EMBEDDING_MODEL,...); centralize the prefix strings as constants
    - src/core/ai/ports.ts — document EmbeddingPurpose semantics (query vs document) so callers pass the right purpose; no signature change required (already present)
    - tests/unit/platform/ai/workers-ai/workers-ai-provider.test.ts — assert query and document purposes produce different prefixed inputs to ai.run
  - **验收**：
    - query and document purposes send measurably different (prefixed) text to the model — asserted in unit test
    - createEmbeddings still returns dimensions and handles empty input as before
    - search/server/service.ts (purpose:'query') and content-processing.ts createChunkEmbeddings (purpose:'document') and metadata-terms.ts paths get the correct asymmetric treatment with no call-site change

- [x] **P1-T3 · chunks: embedding_model + embedding_dim + content_hash columns for incremental re-embed & migratability** — `M` · 依赖: P1-T2 ✅ 2026-06-05（迁移 0010 已应用本地 D1；planChunkEmbeddings 按 hash+model 跳过重嵌、indexPlannedChunks 只 upsert 变化项；AIProvider.embeddingModel；14 个单元测试）
  - **为什么**：asset_chunks (schema/asset-chunks.ts) stores no embedding model/dim or content hash, so we can't tell which chunks are stale when the model/prefix changes (P1-T2) and can't do incremental re-embed — today reprocessing re-embeds everything. Adding embeddingModel/embeddingDim/contentHash lets us skip unchanged chunks (idempotent by content_hash, mirrors doc §7 step-5 '按 content_hash 幂等去重') and detect dimension drift. Per ADR-003 this is a fresh-rebuild migration, not a backfill script.
  - **改动**：
    - src/platform/db/d1/schema/asset-chunks.ts — add embeddingModel text, embeddingDim integer, contentHash text columns + index on (assetId, contentHash)
    - drizzle/0010_*.sql — new migration generated via `npm run db:generate` adding the columns (fresh rebuild, no backfill per ADR-003)
    - src/core/assets/ports.ts — extend CreateAssetChunkInput with embeddingModel/embeddingDim/contentHash
    - src/features/ingest/server/content-processing.ts — indexPreparedChunks: compute contentHash(sha-256 of chunk text) and stamp embeddingModel/embeddingDim from CreateEmbeddingsResult onto each CreateAssetChunkInput; skip re-embed for chunks whose contentHash+model already match (incremental path)
    - src/platform/db/d1/repositories/d1-asset-repository.ts — replaceAssetChunks: persist the new columns
    - src/features/workflows/server/shared-workflow-steps.ts — indexedChunkSchema: include the new optional fields so workflow state round-trips them
    - tests/unit/features/ingest/server/content-processing.test.ts — assert contentHash stable across runs and re-embed skipped when hash+model unchanged
  - **验收**：
    - asset_chunks rows carry embedding_model, embedding_dim, content_hash after ingest
    - Re-ingesting unchanged content does NOT re-embed those chunks (skip-by-hash) — unit test proves it
    - Changing EMBEDDING_MODEL or the prefix (P1-T2) marks chunks stale and triggers re-embed
    - `npm run db:generate` produces migration 0010 and `tsc` passes with the extended CreateAssetChunkInput

- [x] **P1-T4 · Vectorize native metadata filter + drop over-fetch ladder/240 ceiling (index recreate)** — `L` · 依赖: P1-T3 ✅ 2026-06-06（单次原生过滤查询取代 1/3/6/12 阶梯+240 天花板；chunk 向量写入可过滤 metadata；适配器+service 单测；reindex runbook 入 wrangler.jsonc + 架构文档。⚠️ 端到端需部署后 reindex 验证）
  - **为什么**：service.ts getFilteredSemanticMatches walks FILTERED_VECTOR_FETCH_MULTIPLIERS [1,3,6,12] up to MAX_FILTERED_VECTOR_TOP_K=240, post-filtering chunk matches in D1 because the team believed Vectorize couldn't filter natively — the doc §2 platform-facts row says it CAN filter pre-topK. Push filter fields (type/domain/documentClass/sourceKind/sourceHost/collectionKey/aiVisibility/scope_id) into Vectorize metadata at upsert and pass a native filter at query. Vectorize only indexes declared metadata indexes and changing them requires recreating the index — align this one-shot recreate with the ADR-003 L1 fresh rebuild (drop & recreate D1 + Vectorize). Needs full re-embed/re-index of all chunks.
  - **改动**：
    - src/core/vector/ports.ts — add filter?: Record<string,...> to VectorSearchInput and ensure VectorRecord metadata carries the filterable fields
    - src/platform/vector/vectorize/vectorize-store.ts — search(): forward input.filter to this.index.query options; upsert(): keep metadata fields as native (not just textPreview)
    - src/features/ingest/server/content-processing.ts — indexPreparedChunks: write filterable metadata (assetId, chunkIndex, type, domain, documentClass, sourceKind, sourceHost, collectionKey, aiVisibility, scopeId='default', textPreview) onto each VectorRecord
    - src/features/search/server/service.ts — DELETE getFilteredSemanticMatches ladder + FILTERED_VECTOR_FETCH_MULTIPLIERS + MAX_FILTERED_VECTOR_TOP_K; do a single vectorStore.search with native filter built from getSearchFilters(input) and aiVisibility; keep getChunkMatchesByVectorIds only for hydration
    - wrangler.jsonc — document the Vectorize metadata indexes that must be created (via `wrangler vectorize create-metadata-index`) as part of fresh rebuild; note the index recreate requirement in a comment
    - docs/memory-layer-architecture.md — note the one-time index recreate step in the P1 ops runbook (no new doc file)
  - **验收**：
    - A filtered search issues ONE Vectorize query with a native filter (no 1/3/6/12 ladder, no 240 ceiling) — asserted via the fake VectorStore capturing input.filter
    - Chunk vectors are upserted with the full filterable metadata set incl. scopeId='default'
    - Metadata-index creation + Vectorize index recreate are documented as part of the fresh-rebuild runbook
    - Eval (P1-T0): filtered golden queries return correct assets with recall >= baseline at a single fetch

- [ ] **P1-T5 · D1 FTS5/BM25 lexical index with trigram tokenizer for CJK** — `L` · 依赖: P1-T0
  - **为什么**：The lexical layer is dead for Chinese: search-term-expansion.ts splits on /[^a-z0-9_]+/ (drops all CJK) and d1-asset-repository.ts searchAssetSummaries/searchAssetAssertions use LIKE %term% — doc §2 third 🔴 ('中文 lexical 层是死的') and platform-facts row ('D1 原生支持 FTS5/BM25, trigram tokenizer 能处理中文'). Build an FTS5 virtual table with tokenize='trigram' over chunk/summary/assertion text, query with BM25 ranking, and surface rank-ordered lexical candidates to feed the fuser (P1-T6). Replaces the LIKE-ladder lexical retrieval.
  - **改动**：
    - src/platform/db/d1/schema/ — add an FTS5 virtual-table definition (note: drizzle doesn't model FTS5 vtables; define the CREATE VIRTUAL TABLE ... USING fts5(..., tokenize='trigram') + triggers in the migration directly)
    - drizzle/0011_*.sql — new migration: FTS5 trigram virtual table(s) over chunk content + summary + assertion text, with INSERT/UPDATE/DELETE sync triggers from base tables
    - src/platform/db/d1/repositories/d1-asset-repository.ts — add a lexical search method that runs MATCH against the FTS5 table ordered by bm25(), returning {id, bm25Rank} candidates for chunks/summaries/assertions; deprecate the LIKE-based searchAssetSummaries/searchAssetAssertions internals (keep signatures, swap impl)
    - src/platform/db/d1/repositories/search-term-expansion.ts — stop being the CJK chokepoint: route CJK queries to FTS5 MATCH instead of /[^a-z0-9_]+/ token splitting (or bypass expansion for the lexical-FTS path)
    - src/core/assets/ports.ts — add the lexical-search port method returning rank-bearing candidates
    - tests/unit/platform/db/d1/repositories/d1-asset-repository.test.ts + search-term-expansion.test.ts — assert a CJK query returns BM25-ranked rows where LIKE/old tokenizer returned none
  - **验收**：
    - A pure-CJK query (e.g. 中文检索) returns BM25-ranked lexical hits (previously empty) — covered by a test against a seeded D1/FTS5 fixture
    - Lexical results carry a stable rank (not a bespoke 0.38-floor score), suitable as an RRF input list
    - FTS5 triggers keep the index in sync on chunk/summary/assertion insert/update/delete
    - Eval (P1-T0): CJK golden-query Recall@k improves materially vs baseline

- [ ] **P1-T6 · RRF fusion replacing flat concat-then-sort; remove score floors/ceilings** — `L` · 依赖: P1-T4, P1-T5
  - **为什么**：service.ts buildSemanticEvidence/buildLexicalEvidence concat dense + lexical evidence and .sort by raw score across incompatible scales — chunk cosine ~0.4-0.65 vs assertion-scoring.ts 0.38 floor/0.93 ceiling, summary-scoring.ts 0.89 ceiling, term-scoring.ts 0.82 — so keyword-grazing assertions outrank truly semantic chunks (doc §2 second 🔴, §8 'RRF 融合 rank-based 量纲无关'). Replace with Reciprocal Rank Fusion over the per-channel RANKED lists (dense from Vectorize, lexical/BM25 from P1-T5, term-match from term-asset-service), dropping the hardcoded floors/ceilings in the *-scoring.ts files in favor of within-channel rank.
  - **改动**：
    - src/features/search/server/rrf.ts — new: fuseByRRF(channels: RankedList[], k=60) producing a fused candidate list keyed by (assetId,layer,chunkId)
    - src/features/search/server/service.ts — replace buildSemanticEvidence/buildLexicalEvidence flat concat+sort with: build per-channel ranked lists (dense vectorMatches, lexical BM25 from P1-T5, term matches) → fuseByRRF → hydrate to EvidenceItem; keep context-policy filtering
    - src/features/search/server/assertion-scoring.ts, summary-scoring.ts, term-scoring.ts — remove the absolute floor/ceiling magic numbers; these now contribute only WITHIN-channel ordering (rank) consumed by RRF, not a cross-channel absolute score
    - src/features/search/server/evidence.ts — buildGroupedEvidence/calculateAssetScore consume the fused rank/score instead of raw cross-dimension score; recency/priority bonuses become post-fusion tie-breakers
    - tests/unit/features/search/server/service.test.ts + evidence.test.ts — assert a semantically-relevant chunk outranks a keyword-grazing assertion (the exact doc failure case)
  - **验收**：
    - Final ordering comes from RRF over per-channel ranked lists, not a sort across raw dense-vs-lexical scores
    - The doc's failure case (keyword-grazing assertion beating a semantic chunk) is reversed — proven by a unit test
    - No 0.38/0.89/0.93/0.82 absolute floors/ceilings drive cross-channel ordering anymore
    - Eval (P1-T0): aggregate MRR/nDCG@10 improve vs baseline; no golden query regresses below baseline

- [ ] **P1-T7 · bge-reranker-base cross-encoder rerank + MMR over top-N, behind AIProvider port** — `L` · 依赖: P1-T6
  - **为什么**：Doc §8 read path: after RRF, run bge-reranker-base cross-encoder rerank on top-N then MMR for diversity. Workers AI has @cf/baai/bge-reranker-base on the existing AI binding (doc §2 platform-facts row). The AIProvider port (core/ai/ports.ts) has only generateText/createEmbeddings — add a rerank capability so the reranker is provider-swappable, then apply MMR over the reranked candidates to de-duplicate near-identical chunks.
  - **改动**：
    - src/core/ai/ports.ts — add rerank(input:{query, documents:string[], topN?}) → {index, score}[] to AIProvider
    - src/platform/ai/workers-ai/workers-ai-provider.ts — implement rerank via this.ai.run('@cf/baai/bge-reranker-base', {query, contexts}); add RERANKER_MODEL constant
    - src/features/search/server/rerank.ts — new: take fused top-N candidates (from P1-T6), call aiProvider.rerank on their hydrated text, then apply MMR (cosine over candidate embeddings or rerank scores) to balance relevance vs diversity
    - src/features/search/server/service.ts — insert rerank+MMR stage between fuseByRRF and grouping/pagination; guard with a fallback to RRF order if rerank fails (mirrors existing try/catch resilience)
    - tests/unit/features/search/server/service.test.ts — fake AIProvider.rerank reorders candidates; MMR drops a near-duplicate chunk; rerank failure falls back to RRF order
  - **验收**：
    - AIProvider exposes rerank and WorkersAIProvider calls bge-reranker-base on the AI binding
    - Search applies rerank then MMR over fused top-N; near-duplicate chunks are de-duplicated in results
    - Reranker failure degrades gracefully to RRF order (no thrown 500) — covered by a test
    - Eval (P1-T0): nDCG@10 improves over the RRF-only result from P1-T6

- [ ] **P1-T8 · Fix 3 indexing/embedding bugs: delete ghost vectors, reprocess-0-chunks wipe, all-or-nothing batch embed** — `M` · 依赖: P1-T3
  - **为什么**：Doc §2 🐛 trio. (a) assets/server/service.ts deleteAsset only calls softDeleteAsset — never deletes the chunks' Vectorize vectors → ghost vectors keep surfacing in search (also the doc §10 forget() relies on this fix). (b) content-processing.ts indexPreparedChunks: when chunks.length===0 it deletes ALL of an asset's vectors — a transient 0-chunk reprocess wipes a healthy asset's index. (c) createChunkEmbeddings embeds the whole batch at once and throws if embeddings.length!==chunks.length, so one provider hiccup fails the entire asset.
  - **改动**：
    - src/features/assets/server/service.ts — deleteAsset: after softDeleteAsset, look up the asset's chunk vectorIds and call vectorStore.deleteByIds (inject getVectorStore into dependencies like getBlobStore already is)
    - src/core/assets/ports.ts — add a way to fetch an asset's chunk vectorIds for cleanup (or reuse getAssetById chunks)
    - src/features/ingest/server/content-processing.ts — indexPreparedChunks: when chunks.length===0, treat as a no-op/guarded path (do NOT blanket-delete existing vectors unless the asset is genuinely empty AND processing succeeded); reconcile stale vectors only against a successfully produced new set
    - src/features/ingest/server/content-processing.ts — createChunkEmbeddings: embed in sub-batches with per-batch retry; tolerate partial success by aligning embeddings to chunks positionally and skipping/retrying only failed chunks instead of failing the whole asset
    - tests/unit/features/assets/server/service.test.ts — deleteAsset deletes the chunk vectors (no ghosts)
    - tests/unit/features/ingest/server/content-processing.test.ts — 0-chunk reprocess does not wipe existing vectors; a single failed embedding batch doesn't fail the whole asset
  - **验收**：
    - deleteAsset removes the asset's Vectorize vectors (ghost-vector search hits eliminated) — unit test proves deleteByIds called with the chunk vectorIds
    - A reprocess yielding 0 chunks no longer deletes a previously-indexed asset's vectors — unit test
    - A partial embedding failure re-embeds/skips only the affected chunks; the asset still finalizes with the chunks that succeeded — unit test
    - Eval (P1-T0): deleting a golden asset removes it from results on the next query

- [ ] **P1-T9 · Wire eval harness into the final pipeline + lock P1 acceptance metrics** — `S` · 依赖: P1-T1, P1-T6, P1-T7, P1-T8
  - **为什么**：Close the loop started in P1-T0: re-point the harness at the full post-P1 pipeline (structural chunking + RRF + rerank/MMR + FTS5 + native filter) and ratchet the committed thresholds upward so regressions in P2+ are caught. This is the measurable 'real RAG that's actually good' exit gate for the phase (roadmap P1 产出: '真正好用的私有 RAG/搜索').
  - **改动**：
    - tests/eval/eval.test.ts — raise baseline thresholds to the post-P1 metrics; add per-stage breakdown (lexical-only, dense-only, fused, fused+rerank) so future regressions localize
    - tests/eval/golden/queries.jsonl — expand to cover rerank/MMR diversity cases and filter-correctness cases
    - docs/memory-layer-architecture.md — record the P1 baseline-vs-final metric table in the roadmap section (no new doc file)
  - **验收**：
    - `npm run eval` reports post-P1 metrics strictly >= the P1-T0 baseline on every aggregate metric
    - Per-stage (lexical/dense/fused/reranked) metrics are emitted so contributions are attributable
    - Committed thresholds are ratcheted to post-P1 values, guarding P2+ from silent retrieval regressions

### 阶段完成标准（Exit Criteria）

- Chunking preserves document structure (newlines/headings/lists) and produces token-budgeted, sentence-safe chunks per asset type; whitespace is only flattened for summary/preview, never before chunking
- Final ranking is produced by RRF over per-channel ranked lists (dense + BM25/FTS5 + term) followed by bge-reranker-base cross-encoder rerank + MMR; no cross-dimension raw-score sort and no 0.38/0.89/0.93/0.82 floors/ceilings drive ordering
- A pure-CJK query returns BM25-ranked lexical hits via a D1 FTS5 trigram index (previously empty); lexical channel feeds the fuser as a ranked list
- Filtered semantic search is a single Vectorize query using native metadata filtering (incl. scope_id='default'); the 1/3/6/12 over-fetch ladder and 240 ceiling are deleted; the one-time Vectorize index/metadata-index recreate is documented as part of the ADR-003 fresh rebuild
- bge-m3 sends asymmetric query vs passage instruction prefixes (purpose flag is no longer a no-op), applied together with a full re-embed before any P2 migration
- asset_chunks carries embedding_model, embedding_dim, content_hash; re-ingest of unchanged content skips re-embed (idempotent by hash); model/prefix change marks chunks stale
- All 3 bugs fixed: deleteAsset purges Vectorize vectors (no ghosts), a 0-chunk reprocess never wipes a healthy asset's vectors, and embedding runs in retryable sub-batches that tolerate partial failure
- `npm run eval` runs Cloudflare-free in CI over a golden query set and reports Recall@k/MRR/nDCG@10/MAP; post-P1 metrics are strictly >= the recorded pre-P1 baseline and thresholds are ratcheted
- `npm run typecheck`, `npm run lint`, and `npm test` all pass; new drizzle migrations (chunk columns, FTS5 vtable) generate cleanly

### 风险

- Vectorize metadata-index changes require recreating the index — must be sequenced with the ADR-003 L1 fresh rebuild (drop & recreate D1 + Vectorize) in one ops window; doing P1-T4 without the recreate yields silently-unfiltered queries
- bge-m3 prefix change (P1-T2) invalidates all existing passage embeddings — P1-T2/T3/T4 must ship as a single re-embed/re-index pass to avoid embedding the corpus twice (roadmap: P1 re-embed precedes P2 migration)
- drizzle-kit does not model FTS5 virtual tables/triggers — the FTS5 migration (P1-T5) must be authored as raw SQL and kept in sync with base-table writes via triggers; a missed trigger silently rots the lexical index
- D1's ~100-bind / batch limits (already worked around via splitIntoBatches=12/80) constrain FTS5 trigger payloads and any multi-row sync; verify trigram FTS5 + triggers stay within D1 limits and runtime budget
- bge-reranker-base/Workers-AI rerank adds latency and a new failure surface on the read hot path — the RRF-order fallback (P1-T7) must be solid or searches regress to 500s under AI throttling
- Removing absolute score floors/ceilings (P1-T6) changes the public score field semantics in SearchResult/evidence — downstream MCP/chat consumers and UI that read .score must be checked for hardcoded thresholds
- Incremental re-embed by content_hash (P1-T3) can mask a needed re-embed if the hash excludes the prefix/model — hash must incorporate model+prefix version or stale vectors persist
- Eval golden set is small/hand-curated — metrics can be gamed or non-representative; treat thresholds as a ratchet/regression guard, not absolute quality proof, and grow the set over P2+

---

## P2 · 分层：L1 瘦身 + L2 完整知识图谱 schema（FRESH rebuild，激活 extract_entities）

**目标**：把 CloudMind 从"重 L1 + 死着的图骨架"重构为干净的三层地基：L1 assets 瘦身为不可变事实层（加 scope_id/content_hash，移除全部 L2 派生字段），新增 L1 episodes 统一情节流；以 FRESH rebuild（ADR-003：不写数据迁移，drop & recreate D1 + Vectorize index）建立完整的 L2 知识图谱 schema（entities/statements(bi-temporal)/edges(bi-temporal)/provenance/communities）+ graph_entities Vectorize namespace；用 drizzle-zod 生成校验并重新生成全套迁移；最后激活死着的 extract_entities 步骤与 entities artifactType，把 entity/relation 抽取接入 workflow，实体消歧复用 auto-enrichment.ts 现成的 0.86/0.72 + searchMetadataTerms 阈值机制。MVP 仅 default scope（ADR-004：scope_id 贯穿 schema 但只用默认值）。产出：数据干净、L2 图骨架就位、抽取管线把 SPO 写进图。

### 任务

- [ ] **P2-T1 · 瘦身 L1 assets schema：移除 L2 派生列，新增 scope_id / content_hash** — `S` · 依赖: —
  - **为什么**：架构第五节字段迁移表要求 L1 回归不可变事实层：domain/documentClass/sensitivity/aiVisibility/retrievalPriority/descriptorJson 全部上移 L2/L3。assets.ts 现有这些列 + 8 个对应 index 是 L1/L2 耦合的根源；scope_id（ADR-004 贯穿但只用 default）与 content_hash（写路径第 5 步幂等去重的键）必须落在 L1。
  - **改动**：
    - src/platform/db/d1/schema/assets.ts — 删除列 domain/sensitivity/aiVisibility/retrievalPriority/documentClass/descriptorJson 及其枚举常量(assetDomainValues/assetSensitivityValues/assetAiVisibilityValues/assetDocumentClassValues)；删除对应 index(domain/sensitivity/document_class/复合 domain_status_deleted_at 等)；新增 scope_id text NOT NULL default 'default'、content_hash text；保留 type/title/summary/sourceUrl/sourceKind/sourceHost/collectionKey/capturedAt/contentText/rawR2Key/contentR2Key/mimeType/language/status/error 字段；新增 assets_scope_id_idx、assets_content_hash_idx
    - src/platform/db/d1/schema/asset-facets.ts — 删除文件（facets 上移 L2，见 T3）
    - src/platform/db/d1/schema/asset-assertions.ts — 删除文件（assertions 升级为 L2 statements，见 T4）
    - src/platform/db/d1/schema/index.ts — 移除 assetFacets/assetAssertions 的 export
  - **验收**：
    - assets.ts 不再出现 domain/sensitivity/aiVisibility/retrievalPriority/documentClass/descriptorJson 标识符（grep 为空）
    - assets 表含 scope_id(NOT NULL, default 'default') 与 content_hash 列，且有 scope_id 索引
    - schema/index.ts 不再 export assetFacets / assetAssertions；asset-facets.ts、asset-assertions.ts 已删除
    - npx tsc -p tsconfig.json --noEmit 在本任务范围内对 schema 目录无新增类型错误（repo 其余引用错误在 T10 解决）

- [ ] **P2-T2 · 新增 L1 episodes 表（统一 ingest/chat_turn/agent_assert/correction 情节流）** — `S` · 依赖: P2-T1
  - **为什么**：架构第五节定义 episodes 为 Zep 式非损情节流，把三种写入（doc 导入 / chat / agent remember）统一成同一条时间线，是写路径第 1 步 Extract 的落点，也是 L2 provenance 指回的锚点之一。
  - **改动**：
    - src/platform/db/d1/schema/episodes.ts — 新建：id, scope_id(default 'default'), kind text enum('ingest'|'chat_turn'|'agent_assert'|'correction'), asset_id text NULL references assets(id) onDelete set null, raw_text text NULL, raw_r2_key text NULL, occurred_at text, recorded_at text NOT NULL, actor text NULL, created_at text NOT NULL；索引 episodes_scope_id_idx / episodes_asset_id_idx / episodes_kind_idx / episodes_occurred_at_idx
    - src/platform/db/d1/schema/index.ts — 新增 export { episodes }
  - **验收**：
    - episodes 表存在，kind 枚举为四值，asset_id 为可空外键(set null)，含 occurred_at/recorded_at 双时间戳与 raw_text|raw_r2_key 二选一字段
    - schema/index.ts export 了 episodes
    - drizzle schema 编译通过（被 T8 的 db:generate 验证）

- [ ] **P2-T3 · L2 entities 表 + graph_entities Vectorize namespace（节点恒带向量）** — `M` · 依赖: P2-T1
  - **为什么**：架构第六节 entities 是知识图谱节点，每个节点 embedding_vector_id 恒绑向量（Cognee 模式）。实体消歧复用现成 metadata_terms 机制（0.86/0.72 阈值 + searchMetadataTerms），但需独立 graph_entities namespace，避免与 topic/tag/catalog 词项混淆。
  - **改动**：
    - src/platform/db/d1/schema/entities.ts — 新建：id, scope_id(default 'default'), canonical_name text NOT NULL, normalized_name text NOT NULL, type text, embedding_vector_id text NULL, salience real NULL, mention_count integer default 0, first_seen_at text, last_seen_at text, aliases_json text NULL, created_at/updated_at；索引 entities_scope_id_idx / entities_normalized_name_idx / entities_type_idx / entities_vector_id_idx；唯一约束 (scope_id, normalized_name, type)
    - src/core/vector/keys.ts — 新增 createEntityVectorId(scopeId, normalizedName, type) 助手，沿用 metadata-terms.ts 的 term:kind:normalized 风格生成稳定 id
    - src/features/memory/server/graph-entity-terms.ts — 新建：GRAPH_ENTITY_NAMESPACE='graph_entities' 常量 + upsertGraphEntityVectors / searchGraphEntities，结构对照 metadata-terms.ts（embed→upsert namespace + metadataJson；search 走 vectorStore.search 带 namespace）
  - **验收**：
    - entities 表有 embedding_vector_id 列与 (scope_id, normalized_name, type) 唯一约束
    - graph-entity-terms.ts 导出 GRAPH_ENTITY_NAMESPACE='graph_entities' 且 search/upsert 签名与 metadata-terms.ts 对齐（VectorStore + AIProvider 入参）
    - createEntityVectorId 在 keys.ts 导出且对相同输入产出确定性 id
    - schema/index.ts export 了 entities

- [ ] **P2-T4 · L2 statements(facts) 表：SPO + bi-temporal 四字段 + importance/access** — `M` · 依赖: P2-T3
  - **为什么**：架构第六节 statements 是 assertions 的升级版：主谓宾结构、双时间四字段(valid_from/until 事件时 + created_at/expired_at 录入时，Graphiti 冲突置失效不删)、importance/access 为 P3 显著性加权(relevance×exp(-λ·age)×importance×log(1+access))与衰减预留字段。这是 L2 的核心事实单元。
  - **改动**：
    - src/platform/db/d1/schema/statements.ts — 新建：id, scope_id(default 'default'), subject_entity_id text references entities(id), predicate text NOT NULL, object_entity_id text NULL references entities(id), object_literal text NULL, nl_text text NOT NULL, embedding_vector_id text NULL, confidence real, importance real default 0, valid_from text NULL, valid_until text NULL, created_at text NOT NULL, expired_at text NULL, superseded_by_id text NULL self-ref, last_accessed_at text NULL, access_count integer default 0；索引 scope_id / subject_entity_id / object_entity_id / predicate / expired_at / vector_id
    - src/platform/db/d1/schema/index.ts — 新增 export { statements }
  - **验收**：
    - statements 表含全部四个双时间字段 valid_from/valid_until/created_at/expired_at
    - 含 importance/last_accessed_at/access_count/superseded_by_id 字段（P3 显著性/衰减预留）
    - object 为 object_entity_id（外键）与 object_literal（字面量）二选一
    - subject_entity_id / object_entity_id 均外键指向 entities(id)

- [ ] **P2-T5 · L2 edges 表（bi-temporal 有向关系，递归 CTE 多跳遍历基底）** — `S` · 依赖: P2-T3
  - **为什么**：架构第六节 edges 承载实体间有向关系，是 D1 邻接表 + 递归 CTE 多跳召回(P3 读路径第③路)的基底；同样带双时间字段，冲突置 expired_at 失效。与 statements 分离：statements 是带 NL 文本的事实，edges 是纯关系图边。
  - **改动**：
    - src/platform/db/d1/schema/edges.ts — 新建：id, scope_id(default 'default'), src_entity_id text references entities(id), dst_entity_id text references entities(id), relation text NOT NULL, valid_from text NULL, valid_until text NULL, created_at text NOT NULL, expired_at text NULL, weight real default 1, confidence real NULL；索引 scope_id / src_entity_id / dst_entity_id / relation / (src_entity_id, relation) 复合 / expired_at
    - src/platform/db/d1/schema/index.ts — 新增 export { edges }
  - **验收**：
    - edges 表含 src_entity_id/dst_entity_id 双外键 + relation + 四个双时间字段 + weight/confidence
    - 存在 (src_entity_id, relation) 复合索引以支撑递归 CTE 遍历
    - schema/index.ts export 了 edges

- [ ] **P2-T6 · L2 provenance 表（每条 L2 记忆溯回 L1 episode/asset/chunk/span）** — `S` · 依赖: P2-T2, P2-T4, P2-T5
  - **为什么**：架构第六节 provenance = Zep episodic 边，是'记忆能答、事实能证'契约的承重表：每条 statement/entity/edge 都能钻取回 L1 的 episode/asset/chunk_index/span 取原文引用（读路径最后一步）。
  - **改动**：
    - src/platform/db/d1/schema/provenance.ts — 新建：id, scope_id(default 'default'), memory_kind text enum('statement'|'entity'|'edge'), memory_id text NOT NULL, episode_id text NULL references episodes(id), asset_id text NULL references assets(id), chunk_index integer NULL, span_json text NULL, created_at text NOT NULL；索引 (memory_kind, memory_id) 复合 / episode_id / asset_id
    - src/platform/db/d1/schema/index.ts — 新增 export { provenance }
  - **验收**：
    - provenance 表有 (memory_kind, memory_id) 复合索引，memory_kind 枚举为 statement|entity|edge
    - 含 episode_id（→episodes）与 asset_id（→assets）可空外键、chunk_index、span_json
    - schema/index.ts export 了 provenance

- [ ] **P2-T7 · L2 communities 表（整合摘要 + summary 向量）** — `S` · 依赖: P2-T3
  - **为什么**：架构第六节 communities = Zep 社区 / mem0 摘要，承载 P3 sleep-time 的社区聚类 + community summary + summary-of-summaries。P2 只建表骨架（含 summary_vector_id），不实现聚类逻辑。
  - **改动**：
    - src/platform/db/d1/schema/communities.ts — 新建：id, scope_id(default 'default'), member_entity_ids_json text NOT NULL, summary text NULL, summary_vector_id text NULL, refreshed_at text NULL, created_at text NOT NULL；索引 communities_scope_id_idx / communities_refreshed_at_idx
    - src/platform/db/d1/schema/index.ts — 新增 export { communities }
  - **验收**：
    - communities 表含 member_entity_ids_json / summary / summary_vector_id / refreshed_at
    - schema/index.ts export 了 communities
    - 本任务不引入任何聚类/摘要运行时代码（仅 schema）

- [ ] **P2-T8 · drizzle-zod 校验 schema + FRESH 重新生成全套迁移（drop & recreate）** — `M` · 依赖: P2-T1, P2-T2, P2-T3, P2-T4, P2-T5, P2-T6, P2-T7
  - **为什么**：ADR-003 FRESH rebuild：不写历史数据迁移，直接以瘦身后新 schema 重建库。drizzle-zod@0.8.3 已装但全仓未用——用它为新 L1/L2 表生成 insert/select zod schema（统一抽取/写路径校验）。迁移需从干净基线重生（删除旧 0000-0009 + meta，db:generate 出一套对应新 schema 的迁移），因为旧迁移与瘦身后的 assets/已删表不兼容。
  - **改动**：
    - src/platform/db/d1/schema/validation.ts — 新建：用 createInsertSchema/createSelectSchema 为 episodes/entities/statements/edges/provenance/communities 生成 zod schema 并导出，供 T11 抽取管线复用
    - drizzle/ — 删除旧迁移 0000_*.sql … 0009_*.sql 与 drizzle/meta/*（FRESH 基线）；运行 npm run db:generate 重新生成单一基线迁移 0000_*.sql + 新 _journal.json
    - drizzle.config.ts — 确认 schema 入口仍指向 ./src/platform/db/d1/schema/index.ts（无需改）
    - scripts/ — 若 one-click-deploy.mjs / 部署文档提及 Vectorize index 重建，补一条 FRESH 说明：重建前需 wrangler vectorize delete + create（含新增 graph_entities namespace 维度对齐）
  - **验收**：
    - npm run db:generate 成功，drizzle/ 下生成一套与新 schema(index.ts 全部 export)一致的基线迁移，_journal.json 仅含新基线条目
    - 生成的 SQL 中 assets 表无 domain/sensitivity 等已删列，且含 episodes/entities/statements/edges/provenance/communities 六张新表
    - validation.ts 导出全部六张新表的 insert/select zod schema 且 tsc 通过
    - 迁移可在本地 wrangler d1 migrations apply（--local）干净执行无报错

- [ ] **P2-T9 · 下线 L1 派生写路径：移除 facets/assertions/access_policy/descriptor 步骤与仓储方法** — `L` · 依赖: P2-T1
  - **为什么**：shared-workflow-steps.ts 仍跑 derive_descriptor/derive_access_policy/derive_facets/derive_assertions 四步，写入已删的 assets 列与 asset_facets/asset_assertions 表；d1-asset-repository.ts 的 replaceAssetFacets/replaceAssetAssertions/updateAssetIndexing 引用已删列。瘦身后这些必须下线，否则 tsc/运行时全断。这是 T1 删列后的强制清理，先于 T11 接入新抽取。
  - **改动**：
    - src/features/workflows/server/shared-workflow-steps.ts — 从 buildSharedIngestSteps 移除 createDeriveDescriptorStep/createDeriveAccessPolicyStep/createDeriveFacetsStep/createDeriveAssertionsStep 调用及函数；移除对 indexing-policy 的 deriveDescriptor/deriveAccessPolicy/deriveFacets、assertion-extraction、metadata-terms 旧 import；clean_content→summarize→persist_content→chunk→embed→index→finalize 链保留
    - src/platform/db/d1/repositories/d1-asset-repository.ts — 删除 replaceAssetFacets/replaceAssetAssertions/searchAssetAssertions/getAssetsByFacetTerms/searchAssetSummaries 中对已删列的引用；updateAssetIndexing 收敛为仅写 sourceKind/sourceHost/collectionKey/capturedAt/content_hash/scope_id；createTextAsset/createUrlAsset/createFileAsset 去掉 domain/sensitivity/aiVisibility/retrievalPriority/documentClass/descriptorJson 赋值，补 scope_id='default'
    - src/platform/db/d1/repositories/d1-asset-repository-helpers.ts — 删除 createInitialTextFacetRows/createInitialTextDescriptorJson/mapFacetSummary/mapAssertionSummary 等依赖已删列/表的 helper
    - src/core/assets/ports.ts — 移除 replaceAssetFacets?/replaceAssetAssertions?/CreateAssetFacetInput/CreateAssetAssertionInput/UpdateAssetIndexingInput 中已删字段；收敛 AssetIngestRepository 接口
    - src/features/workflows/server/indexing-policy.ts + policies/* + assertion-extraction.ts — 删除或裁剪不再被调用的 deriveAccessPolicy/deriveFacets/deriveAssertions 路径
  - **验收**：
    - buildSharedIngestSteps 不再包含 derive_descriptor/derive_access_policy/derive_facets/derive_assertions 步骤
    - d1-asset-repository.ts 不再引用 assetFacets/assetAssertions 及已删 assets 列（grep 为空）
    - ports.ts 不再声明 replaceAssetFacets/replaceAssetAssertions
    - npm run typecheck 通过（全仓，无 L1 残列引用错误）

- [ ] **P2-T10 · 对齐 model/types 与读模型：清除 assets 残留派生类型，修复 tsc/test** — `L` · 依赖: P2-T9
  - **为什么**：AssetDetail/AssetSummary/枚举类型(AssetDomain/AssetSensitivity/AssetDocumentClass/AssetFacetKey/AssetAssertionKind)在 features/assets/model/types.ts 与多处读模型/UI/search/chat 中被引用；auto-enrichment.ts 的 buildSyntheticTextAsset 也填充这些字段。瘦身后必须统一裁剪，否则 typecheck/测试红。此任务是把 T1/T9 的删列在类型层与消费侧收口。
  - **改动**：
    - src/features/assets/model/types.ts — 从 AssetDetail/AssetSummary 删除 domain/sensitivity/aiVisibility/retrievalPriority/documentClass/descriptorJson/facets/assertions 字段及对应枚举类型导出；新增 scopeId/contentHash
    - src/features/ingest/server/auto-enrichment.ts — buildSyntheticTextAsset 去掉已删字段赋值，补 scopeId:'default'/contentHash:null
    - src/features/search/server/* 与 src/features/chat/server/service.ts — 移除对 assets.retrievalPriority/aiVisibility/assertions/facets 的 orderBy/过滤引用（assertion/facet 召回路在 P3 用 L2 重建，此处先下线以保编译）
    - tests/unit/** — 更新涉及已删字段的 fixture 与断言（assets/search/evidence 相关）
  - **验收**：
    - AssetDetail/AssetSummary 不含已删派生字段，含 scopeId/contentHash
    - npm run typecheck 全仓通过
    - npm test 全绿（更新后的 fixture 无引用已删字段）
    - npm run lint（biome check）通过

- [ ] **P2-T11 · 激活 extract_entities 步骤 + entities artifactType，接入 SPO 抽取与实体消歧** — `L` · 依赖: P2-T3, P2-T4, P2-T5, P2-T6, P2-T8, P2-T9
  - **为什么**：架构第六/七节 + ADR-001：extract_entities 步骤与 entities artifactType 在 schema/workflow-steps.ts、schema/asset-artifacts.ts、model/types.ts 三处 enum 里已死着；本任务把它们激活并真正产出。写路径第 2-3 步 Cognify+Resolve：Workers AI 抽 entities+statements(SPO)，每个实体 embed→graph_entities namespace ANN 找相似，复用 auto-enrichment.ts 的 0.86/0.72 阈值（≥0.86 复用已有实体、<0.72 新建、之间走 LLM/保守复用）。P2 落 ADD 路径写 entities/statements/edges/provenance（幂等去重按 content_hash），Reconcile 的 UPDATE/DELETE 失效逻辑留 P3。
  - **改动**：
    - src/features/workflows/server/entity-extraction.ts — 新建：deriveEntitiesAndStatementsWithAI（结构对照 assertion-extraction.ts）：Workers AI 抽 {entities:[{name,type}], statements:[{subject,predicate,object|literal,confidence}]}，严格 zod schema 校验(复用 T8 validation.ts)，失败回退空集
    - src/features/memory/server/entity-resolution.ts — 新建：resolveEntity 复用 graph-entity-terms.ts searchGraphEntities + HIGH=0.86/LOW=0.72 常量（与 auto-enrichment.ts 同值），≥0.86 命中复用 entity_id 并 bump mention_count/last_seen_at，<0.72 新建 entity + upsertGraphEntityVectors，中间区间保守新建并记日志
    - src/features/workflows/server/shared-workflow-steps.ts — 新增 createExtractEntitiesStep()（type:'extract_entities'）插入 finalize 前：调用 entity-extraction + entity-resolution，写 entities/statements/edges/provenance，产出 artifactType:'entities' 的 inline artifact(metadataJson 记 entityCount/statementCount)
    - src/platform/db/d1/repositories/d1-memory-repository.ts — 新建：upsertEntity/insertStatement/insertEdge/insertProvenance + findEntityByNormalizedName（幂等：按 (scope_id, normalized_name, type) 与 content_hash 去重），并在 WorkflowServices 暴露 memoryRepository
    - src/features/workflows/server/runtime.ts — WorkflowServices 增加 memoryRepository 依赖；note/url/pdf-ingest-workflow.ts run* 入口注入
    - src/features/workflows/server/registry.ts — 确认三条 ingest workflow 均含新 extract_entities 步骤（buildSharedIngestSteps 统一注入即可）
  - **验收**：
    - extract_entities 步骤出现在 note/url/pdf 三条 workflow 的步骤列表中并真实执行（不再是死 enum）
    - 运行一次 ingest 后 entities/statements/edges/provenance 有行写入，且生成 artifactType='entities' 的 artifact
    - entity-resolution 使用与 auto-enrichment.ts 相同的 0.86/0.72 常量，命中已有实体时复用 entity_id 并 bump mention_count（单测覆盖 ≥0.86 复用 / <0.72 新建 / 中间区间三分支）
    - 重复 ingest 相同 content_hash 不产生重复 entity/statement 行（幂等单测通过）
    - npm run typecheck + npm test + npm run lint 全通过

### 阶段完成标准（Exit Criteria）

- L1 assets 瘦身完成：已移除 domain/documentClass/sensitivity/aiVisibility/retrievalPriority/descriptorJson 及 asset_facets/asset_assertions 表，新增 scope_id(default 'default')/content_hash 并有索引（grep 旧列名为空）
- L1 episodes 表就位，kind 枚举统一 ingest/chat_turn/agent_assert/correction，含 occurred_at/recorded_at 双时间戳
- L2 五表(entities/statements/edges/provenance/communities)全部建成：statements 与 edges 均带 bi-temporal 四字段(valid_from/valid_until/created_at/expired_at)，statements 含 importance/last_accessed_at/access_count，节点/事实带 embedding_vector_id，provenance 能溯回 episode/asset/chunk/span
- graph_entities Vectorize namespace 与 upsert/search 助手就位，结构对照 metadata_terms
- drizzle-zod 为六张新表生成 insert/select 校验；FRESH 重生成单一基线迁移(旧 0000-0009 + meta 清除)，wrangler d1 migrations apply --local 干净通过
- extract_entities 步骤与 entities artifactType 从死 enum 激活为真实产出：ingest 一次后 L2 表有数据 + 生成 entities artifact，实体消歧复用 0.86/0.72 + searchGraphEntities，相同 content_hash 幂等去重
- 全仓 npm run typecheck / npm test / npm run lint 三绿，三条 ingest workflow(note/url/pdf)端到端可跑通新链路

### 风险

- FRESH rebuild 删除旧迁移 + drop & recreate D1/Vectorize index 是不可逆破坏性操作：现有部署的已 ingest 数据全失（ADR-003 接受，原始资产可从 R2 重放），需在部署文档/one-click-deploy 显式告警并要求确认
- 删 assets 派生列的 blast radius 大：d1-asset-repository.ts、ports.ts、assets/model/types.ts、search/chat service、UI、测试 fixture 全连带（T9/T10 两个 L 任务），低估会导致 typecheck 长时间红——必须按 T1→T9→T10 顺序收口
- D1+Vectorize 非事务：extract_entities 写 entities/statements/edges/provenance + upsert 向量跨两套存储，中途失败会图↔向量漂移；P2 仅保证按 content_hash 幂等 ADD，Reconcile(UPDATE/DELETE 失效)与漂移修复显式留 P3 sleep-time，不在本阶段兜底
- 实体消歧质量是 AI 依赖的真难点(ADR-001 已标注)：0.86/0.72 阈值直接搬自词项归一场景，对人名/专有名词可能误合并或过度新建——P2 采用保守新建+严格 zod 校验兜底，阈值调优与矛盾检测留 P3
- graph_entities namespace 与现有 chunk 向量、metadata_terms 共用同一 Vectorize index：需确认维度一致(bge-m3)且 namespace 隔离生效，否则 ANN 召回串味
- statements vs edges 职责边界若在抽取期划不清(同一关系既写 statement 又写 edge)会产生冗余/不一致：T11 需在 entity-extraction 明确 SPO 中 object 为实体→同时落 edge、object 为字面量→仅落 statement 的规则
- Vectorize index 维度/配置变更需 wrangler vectorize delete+create，与 D1 迁移不在同一事务，部署编排(deploy script)需保证两者同步重建，否则向量写入维度不匹配报错

---

## P3 · 记忆心脏 — 智能写(调和+双时间) · 显著性/衰减 · 图增强检索 · sleep-time 整合/遗忘

**目标**：把 CloudMind 从"分层骨架就位"(P2) 升级为名副其实的记忆层：写入时做 mem0 式 ADD/UPDATE/DELETE/NOOP 调和(embed候选→ANN→LLM判定→ajv校验→content_hash幂等)，矛盾用 Graphiti 式 bi-temporal 失效(expired_at/superseded_by)而非删除；读取时把 1-2 跳图遍历(递归CTE)融入 P1 的 RRF+reranker 管线，并以 relevance×exp(-λ·age)×importance×log(1+access) 显著性加权替换 evidence.ts 的 3 档 recency bonus，命中经 Queue 异步回写 last_accessed/access_count；用 Cloudflare Cron Trigger + Queue 跑 sleep-time 整合/遗忘 job（去重合并、社区摘要、衰减归档、修复 D1↔Vectorize 漂移并重放未完成调和）。全程 default scope，scope_id 贯穿但只用默认值。依赖 P2 已建 L2 表(entities/statements/edges/provenance/communities/episodes)与 P1 已修好的 RRF+reranker 检索管线。

### 任务

- [ ] **P3-T0 · L2 端口与 D1 仓储：entities/statements/edges/provenance/communities 的读写接口(含 bi-temporal 与 content_hash 幂等)** — `L` · 依赖: —
  - **为什么**：P3 所有写/读/整合任务都要操作 P2 建的 L2 表，但当前 src/core 与 src/platform/db/d1 只有 asset/workflow 仓储，没有任何 L2 端口或仓储。先落地一层薄端口+D1 实现，让后续任务有稳定的调和/检索/维护 API，并把 content_hash 幂等、双时间四字段(valid_from/valid_until/created_at/expired_at)与 superseded_by 的语义收口在仓储层一处。这是其它所有 P3 任务的地基，且与 P2 的 DDL 直接对齐。
  - **改动**：
    - src/core/memory/ports.ts: 新增 MemoryGraphRepository 端口——upsertEntityByContentHash / searchEntitiesByVectorIds / insertStatement / supersedeStatement(set expired_at+superseded_by_id) / touchStatement(回写 last_accessed_at/access_count) / insertEdge / supersedeEdge / insertProvenance / traverseEdgesRecursive(1-2 跳) / listStatementsByContentHash；全部参数带 scopeId(默认 'default')
    - src/core/memory/types.ts: 新增 EntityRecord/StatementRecord/EdgeRecord/ProvenanceRecord/CommunityRecord 领域类型(对齐架构文档第六节字段)
    - src/platform/db/d1/repositories/d1-memory-repository.ts: 新增 Drizzle 实现，bi-temporal 写以 expired_at=now/superseded_by_id 标记失效而非 DELETE；content_hash 唯一约束驱动 upsert 幂等
    - src/platform/db/d1/repositories/get-memory-repository.ts: 新增 getMemoryRepositoryFromBindings(bindings) 装配
    - src/platform/db/d1/schema/index.ts: re-export P2 已建的 entities/statements/edges/provenance/communities schema(若 P2 未 re-export 则补)
  - **验收**：
    - npm run typecheck 通过；新端口与 D1 实现编译无误
    - 单测覆盖：supersedeStatement 写入后原行 expired_at 非空且 superseded_by_id 指向新 statement，原行未被物理删除(SELECT 仍可查到)
    - 单测覆盖：同一 content_hash 重复 upsertEntityByContentHash/insertStatement 不产生重复行(幂等)
    - traverseEdgesRecursive(depth=2) 在构造的 3 节点 2 边图上返回正确的 1 跳与 2 跳邻居，且 depth 上限被强制(>2 截断)

- [ ] **P3-T1 · Cognify 抽取步骤：激活 extract_entities，从内容产出 entities + SPO statements(ajv 校验)** — `M` · 依赖: P3-T0
  - **为什么**：调和的前提是先有候选 entities/statements。WorkflowStepType 已含 'extract_entities'、AssetArtifactType 已含 'entities'(model/types.ts:44/52)，但在 buildSharedIngestSteps 里是死代码。复用 assertion-extraction.ts 与 prompts registry 的成熟模式(generateText→parseJsonObject→schema 校验→heuristic 兜底)新增一个 cognify 步骤，产出主谓宾结构的候选，喂给 T2 调和。按 ADR-001 这是 P3 核心。
  - **改动**：
    - src/features/workflows/server/cognify-extraction.ts: 新增 extractEntitiesAndStatements(aiProvider, context)，输出 {entities:[{name,type,aliases?}], statements:[{subject,predicate,object|literal,nl_text,confidence}]}
    - src/features/ingest/server/prompts/cognify-v1.ts + prompts/index.ts: 新增 'cognify' prompt(SPO 抽取，指令 JSON-only)，注册到 ingestPromptRegistry
    - src/features/ingest/server/json-schema.ts: 新增 ajv 单例(new Ajv({allErrors})+addFormats) 与 compile 缓存，导出 validateCognifyOutput；这是 ajv 在应用代码的首次落地
    - src/features/workflows/server/shared-workflow-steps.ts: 新增 createCognifyStep()(key/type='extract_entities')，把候选写入 workflow state(state.cognify)，并产出 'entities' artifact
    - src/features/workflows/server/{note,url,pdf}-ingest-workflow.ts: 在 derive_assertions 之后、persist/finalize 链路内插入 cognify 步骤(经 buildSharedIngestSteps 暴露开关)
  - **验收**：
    - cognify 步骤运行后 workflow state 含结构化 entities/statements，且非法 LLM 输出经 ajv 校验失败时回退到空候选而非抛错中断 run
    - 单测：给定固定 LLM mock 输出，extractEntitiesAndStatements 返回去重后的 entities/statements；畸形 JSON 触发 heuristic/empty 兜底并记录 warn
    - 新增 run 的 asset_artifacts 出现一条 artifactType='entities' 记录
    - npm test 通过，npm run typecheck 通过

- [ ] **P3-T2 · Resolve+Reconcile：候选 embed→Vectorize ANN→LLM 判 ADD/UPDATE/DELETE/NOOP(ajv 校验, content_hash 幂等)** — `L` · 依赖: P3-T0, P3-T1
  - **为什么**：这是架构文档第七节'记忆 vs 文档库的分水岭'(第 4 步)。每个候选 entity/statement 先 embed 并在新 graph_entities/graph_statements namespace 做 ANN(复用 metadata-terms.ts 的 namespace+0.86/0.72 阈值机制做实体消歧)，把相似的既有记忆作为上下文喂给 LLM，由其对每个候选判 ADD/UPDATE/DELETE/NOOP；输出经 ajv schema 校验，再落 L2。整条调和按 content_hash 幂等，保证可被 T7 的 sleep-time job 安全重放(对应非事务难点)。
  - **改动**：
    - src/features/workflows/server/reconcile.ts: 新增 reconcileCandidates(services, scopeId, candidates)——对每个候选 embed→memoryRepo.searchEntities/StatementsByVectorIds→构造调和 prompt→LLM→ajv 校验决策→落库
    - src/features/ingest/server/prompts/reconcile-v1.ts + prompts/index.ts: 新增 'reconcile' prompt(给定候选+近邻既有记忆，要求逐条 JSON 决策 {action:'ADD|UPDATE|DELETE|NOOP', target_id?, reason})
    - src/features/ingest/server/json-schema.ts: 增加 validateReconcileDecision(ajv)
    - src/features/ingest/server/memory-vectors.ts: 新增 graph_entities/graph_statements namespace 的 upsert/search(参照 metadata-terms.ts，沿用 HIGH=0.86/LOW=0.72)
    - src/features/workflows/server/shared-workflow-steps.ts: 新增 createReconcileStep()(type='extract_entities' 的后继或合并步)，ADD→insert+provenance；UPDATE→supersedeStatement(写 expired_at+superseded_by)+insert 新版；DELETE→supersede 失效；NOOP→仅 touch；全部按 content_hash 去重
  - **验收**：
    - UPDATE 决策使旧 statement.expired_at 被置、superseded_by_id 指向新行，新行 valid_from=now；DELETE 决策只置 expired_at 不物理删(单测断言)
    - 同一资产二次 reprocess 不产生重复 statement/entity(content_hash 幂等，单测)
    - LLM 决策非法(ajv 失败)时该候选回退为 NOOP 并 warn，不破坏整条 run
    - 每条新写 statement 都有对应 provenance 行指回 episode/asset/chunk(单测断言)
    - npm test / typecheck 通过

- [ ] **P3-T3 · Importance 评分(LLM 1-10)写入 statement.importance(ajv 校验, 缺失走 heuristic 兜底)** — `M` · 依赖: P3-T2
  - **为什么**：显著性加权(T6)与遗忘(T7)都需要 importance 维度，L2 statements 表已留 importance 字段。在调和落库前对每条 statement 由 LLM 评 1-10 的重要度，复用 generateText+ajv 模式；LLM 失败时用 confidence/kind 的 heuristic 兜底，保证字段恒有值，避免下游加权/遗忘出现 null 分支。
  - **改动**：
    - src/features/workflows/server/importance-scoring.ts: 新增 scoreImportance(aiProvider, statements)→Map<stmt, 1..10>，clamp+ajv 校验，失败回退 heuristic(confidence*kind 权重)
    - src/features/ingest/server/prompts/importance-v1.ts + prompts/index.ts: 新增 'importance' prompt(批量打分，JSON-only)
    - src/features/ingest/server/json-schema.ts: 增加 validateImportanceScores(ajv)
    - src/features/workflows/server/reconcile.ts: ADD/UPDATE 落库时写入 importance(归一到文档定义区间)
  - **验收**：
    - 每条新写 statement.importance ∈ [1,10] 且非空(单测)
    - LLM 返回越界/非数字时被 clamp 或回退 heuristic，run 不中断(单测)
    - npm test / typecheck 通过

- [ ] **P3-T4 · 异步访问回写：新增 'touch' Queue 消息 + 消费者，非阻塞 bump last_accessed_at/access_count** — `M` · 依赖: P3-T0
  - **为什么**：架构文档第八节要求'命中即经 Queue 异步 bump last_accessed/access_count(写回闭环)'，必须非阻塞以免拖慢读路径。现有 Queue 端口/consumer(queue-consumer.ts + app/server.ts 的 queue handler)只认 'workflow_step'。新增 'memory_touch' 消息类型与一个轻量消费分支，命中的 statement/entity id 异步入队，由消费者批量调 memoryRepo.touchStatement。这是替换 evidence.ts 3 档 recency 的访问反馈来源(T6 消费它写回的数据)。
  - **改动**：
    - src/features/memory/server/touch-queue.ts: 新增 enqueueMemoryTouch(jobQueue, {scopeId, statementIds, entityIds}) 与 parseMemoryTouchPayload/consumeMemoryTouchMessage
    - src/features/workflows/server/queue-consumer.ts: 在 consumeWorkflowQueueMessage 之外，按 message.type 分流——'memory_touch' 走 touch 消费者(或新增 consumeQueueMessage 统一入口)
    - app/server.ts: queue handler 按 body.type 路由到 workflow 或 memory_touch 消费者
    - src/platform/db/d1/repositories/d1-memory-repository.ts: 实现 touchStatement/touchEntities 的批量 UPDATE(access_count+1, last_accessed_at=now)
  - **验收**：
    - touch 消息以 dedupeKey 去重，消费后对应 statement.access_count 增 1、last_accessed_at 更新(集成/单测)
    - touch 入队失败/消费失败不影响读路径返回结果(读路径对回写做 fire-and-forget，单测断言不 await 阻塞)
    - 未知 message.type 在 queue handler 抛出明确错误(保持现有 runtime.ts 契约)
    - npm test / typecheck 通过

- [ ] **P3-T5 · 图增强召回：1-2 跳递归 CTE 作为第三路，融入 P1 的 RRF+reranker 管线** — `L` · 依赖: P3-T0, P3-T2
  - **为什么**：架构文档第八节第③路'图遍历(D1 递归 CTE, 1-2 跳)'要与向量、BM25 一起经 RRF 融合再 rerank。当前 search/service.ts 只有 vector+lexical 两路、在 evidence.ts 做量纲硬排序(P1 已替换为 RRF+reranker)。新增图召回：先从 query 命中的实体/向量种子出发，traverseEdgesRecursive 取 1-2 跳关联 statement，作为 RRF 的第三个 ranked list 注入。default scope 过滤。
  - **改动**：
    - src/features/search/server/graph-recall.ts: 新增 recallByGraph(memoryRepo, seedEntityIds, {scopeId, maxHops:2})→ranked statement 列表(带跳数衰减)
    - src/features/search/server/service.ts: executeSearch 在并行召回处增加第三路 graphMatches；种子实体来自 query embedding 的 graph_entities ANN(复用 T2 的 memory-vectors)
    - src/features/search/server/<rrf-fusion module from P1>.ts: 把 graph ranked list 作为额外输入参与 RRF(rank-based, 量纲无关)，再走 bge-reranker
    - src/features/search/model/evidence.ts: EvidenceLayer/MatchReason 增加 'graph' 类型，使图命中可在 evidence 包中呈现来源与跳数
  - **验收**：
    - 构造的小图(A-rel->B-rel->C)以 A 为种子时，2 跳召回包含 C 且其排序权重低于 1 跳的 B(单测)
    - 图路返回为空或 D1 CTE 失败时检索整体降级为 vector+lexical，不抛错(兜底单测)
    - RRF 融合输入从 2 路扩为 3 路后，eval harness(P1 引入)指标不回退(回归基线对比)
    - 仅 default scope 的边/语句参与遍历(单测断言 scope 过滤)
    - npm test / typecheck 通过

- [ ] **P3-T6 · 显著性加权替换 3 档 recency：relevance×exp(-λ·age)×importance×log(1+access)，并触发 touch 回写** — `M` · 依赖: P3-T3, P3-T4, P3-T5
  - **为什么**：evidence.ts 的 getRecencyBonus(7/30/90 天三档硬编码, 232-260 行)、getAssetPriorityBonus 是文档点名的硬伤(第二节'仅 3 档硬编码 recency bonus；无衰减/遗忘')。改为连续衰减+importance+访问对数的乘性加权(文档第八节公式)，数据来自 L2 statement 的 last_accessed_at/access_count/importance(由 T3/T4 维护)而非 asset 的 capturedAt。读路径产出最终结果后，把命中的 statement/entity id 经 T4 的 'touch' 队列异步回写，形成闭环。
  - **改动**：
    - src/features/search/server/salience.ts: 新增 applySalience(item, {now, lambda})=relevance×exp(-λ·ageDays)×(importance/10)×log(1+access)；λ 可配置常量
    - src/features/search/model/evidence.ts: 移除/替换 getRecencyBonus 三档与 getAssetPriorityBonus，calculateAssetScore 改用 salience；保留 EvidenceItem 携带 importance/lastAccessed/access 字段
    - src/features/search/server/service.ts: executeSearch 末尾对最终 pageItems 命中的 memory id 调 enqueueMemoryTouch(fire-and-forget)
    - src/features/search/server/service.ts: EvidenceItem 装配处补充从 L2 statement 读出的 importance/last_accessed_at/access_count
  - **验收**：
    - calculateAssetScore 不再调用三档 getRecencyBonus；同 relevance 下高 importance/高 access/低 age 的记忆排序更高(单测覆盖三个因子的单调性)
    - age 衰减为连续函数(exp(-λ·age))，无 7/30/90 断点(单测断言无阶跃)
    - 一次检索后命中记忆经 touch 队列异步 bump(集成断言 access_count 最终增加，且不阻塞响应)
    - 缺 importance/access 数据时回退默认值不报 NaN(兜底单测)
    - npm test / typecheck 通过

- [ ] **P3-T7 · Sleep-time 整合/遗忘 job：Cron Trigger + Queue(去重合并/社区摘要/衰减归档/修复漂移与重放调和)** — `L` · 依赖: P3-T0, P3-T2, P3-T3
  - **为什么**：架构文档第九节要求用 Cloudflare Cron Trigger + Queue 跑后台'睡眠期'维护。当前 app/server.ts 无 scheduled handler、wrangler.jsonc 无 triggers。新增 cron 触发器把维护任务分片入队(避免单次 CPU 超时)，由消费者执行：①整合(近重复 statement 合并、社区聚类+生成 community summary)②遗忘(低 importance×长期未访问→衰减/归档)③修复(重放 T2 未完成的调和、补 provenance、修 D1↔Vectorize 漂移)。修复③正是处理 D1/Vectorize 非事务的兜底——调和幂等(T2)使重放安全。
  - **改动**：
    - wrangler.jsonc: 新增 "triggers":{"crons":["0 3 * * *"]}；新增第二个 queue producer+consumer 'cloudmind-maintenance'(MAINTENANCE_QUEUE binding)
    - src/env.ts: AppBindings 增加 MAINTENANCE_QUEUE?: Queue
    - app/server.ts: 新增 scheduled(controller, env, ctx) handler，调 enqueueMaintenanceTasks；queue handler 增加 maintenance 分流
    - src/features/memory/server/sleeptime/consolidation.ts: 近重复 statement 合并(graph_statements ANN+阈值)、社区聚类与 community summary(LLM)+summary_vector 落 communities 表
    - src/features/memory/server/sleeptime/forgetting.ts: 选 importance 低×last_accessed_at 久的 statement→衰减/archive(置 expired_at 或 archived 标记，不动 L1)
    - src/features/memory/server/sleeptime/repair.ts: 扫描 statements/entities 缺 vector 或 Vectorize 有孤儿向量→重嵌/清理；扫 reconcile 未完成的中间态(content_hash 已写 L1 episode 但无 L2)→重放 reconcileCandidates
    - src/features/memory/server/sleeptime/queue.ts: 任务分片入队/消费(enqueueMaintenanceTasks/consumeMaintenanceMessage)
  - **验收**：
    - 本地 wrangler dev 触发 scheduled(或单测调度入口) 能把整合/遗忘/修复任务入队并被消费者执行
    - repair 单测：构造一条'L1 有 episode 但 L2 缺 statement'的中间态，job 运行后经幂等 reconcile 补齐且不重复(可重复运行收敛)
    - repair 单测：构造 D1 有 statement 但 Vectorize 无对应向量(及反向孤儿向量)，job 后漂移被修复
    - forgetting 单测：低 importance×久未访问的 statement 被置失效/归档，L1 episodes/assets 不受影响(数据主权铁律)
    - consolidation 单测：两条近重复 statement 合并为一，provenance 不丢失
    - npm test / typecheck 通过；wrangler.jsonc 通过 schema 校验

- [ ] **P3-T8 · 端到端记忆链路测试 + P3 验收 harness(写→调和→图检索→显著性→sleep-time 修复)** — `M` · 依赖: P3-T2, P3-T5, P3-T6, P3-T7
  - **为什么**：P3 各任务跨写/读/后台三条路径且彼此耦合(content_hash 幂等贯穿 T2/T7、touch 闭环贯穿 T4/T6)，需要一个端到端用例守住'名副其实的记忆层'的整体行为，并防止 P1 检索基线回退。复用 P1 引入的 eval harness 扩展记忆专用断言。
  - **改动**：
    - tests/integration/memory/reconcile-lifecycle.test.ts: ingest 两条矛盾事实→断言第二条触发 UPDATE/bi-temporal 失效、recall 默认只返回最新、as_of 早期时间仍能取到旧值(若 P4 未上 as_of 则仅断言 expired_at 状态)
    - tests/integration/memory/graph-recall.test.ts: 建实体边后多跳 recall 命中关联记忆并参与 RRF
    - tests/integration/memory/salience-and-touch.test.ts: 重复访问提升 access_count→后续排序上升
    - tests/integration/memory/sleeptime-repair.test.ts: 注入漂移/未完成调和→job 后收敛
    - tests/eval/* (扩展 P1 harness): 加入记忆召回质量回归基线
  - **验收**：
    - 全部端到端用例 npm test 通过
    - P1 检索 eval 指标在加入图路+显著性后不回退(基线对比断言)
    - 矛盾→bi-temporal 失效、图多跳召回、显著性排序、sleep-time 修复四条主行为各有一条通过的集成断言
    - npm run typecheck / npm run lint 通过

### 阶段完成标准（Exit Criteria）

- 写路径在 ingest/reprocess 时对每条候选记忆执行 ADD/UPDATE/DELETE/NOOP 调和：embed→Vectorize ANN→LLM 判定→ajv 校验→content_hash 幂等落 L2，且 provenance 指回 L1
- 矛盾不再 DELETE：UPDATE/DELETE 决策通过置 expired_at + superseded_by_id 实现 bi-temporal 失效，L1 episodes/assets 永不被改写
- 每条 statement 带 LLM(1-10) importance；evidence.ts 的 3 档硬编码 recency bonus 被 relevance×exp(-λ·age)×importance×log(1+access) 连续显著性加权替换
- 读路径命中经独立 'memory_touch' Queue 异步、非阻塞回写 last_accessed_at/access_count
- 图增强召回(1-2 跳递归 CTE)作为第三路融入 P1 的 RRF+reranker 管线，default scope 过滤
- Cloudflare Cron Trigger + maintenance Queue 跑 sleep-time job：近重复合并/社区摘要/低显著性衰减归档/修复 D1↔Vectorize 漂移并重放未完成调和
- D1+Vectorize 非事务以幂等调和兜底：sleep-time repair 可安全重放使系统收敛，且重放不产生重复
- scope_id 贯穿 L2 写/读/维护接口，但 MVP 仅使用 default 值(ADR-004)
- npm run typecheck / lint / test 全绿；P1 检索 eval 基线不回退

### 风险

- 强依赖 P2：entities/statements/edges/provenance/communities/episodes 表与 episodes 写入必须由 P2 落地(当前 drizzle 最新到 0009，无 L2 表)。P3-T0 假设这些表已存在；若 P2 未完成，P3 全部阻塞。
- 强依赖 P1：图路要融入 P1 的 RRF+reranker 与 eval harness。若 P1 的 RRF 模块/eval 未就位(本仓 evidence.ts 仍是量纲硬排序、search/service.ts 仍是 2 路)，T5/T6/T8 需先补 P1 缺口或调整接入点。
- Workers AI(qwen3-30b) 无原生 function-calling/tool API(workers-ai-provider.ts 只发 flat prompt)，调和/抽取/打分全靠 JSON-only prompt + ajv 校验 + heuristic 兜底；LLM JSON 稳定性是 AI 质量主要失败面(ADR-001 已记)。
- 实体消歧/矛盾检测准确率是真难点：阈值(沿用 0.86/0.72)与 LLM 判定误差会引入错误 UPDATE/DELETE；以 bi-temporal 失效(可回溯)+幂等重放+严格 schema 兜底，但仍需 eval 监控。
- D1 CPU/时间限制：递归 CTE 多跳遍历与 sleep-time 整合可能超单次 Worker CPU 预算；以深度上限(≤2)、Cron 分片入队、批量处理控制(T5/T7),需压测。
- D1↔Vectorize 非事务导致中间态(L1 写成功、L2/向量未写)在所难免；正确性依赖 T7 repair + T2 幂等收敛,需保证 content_hash 与 provenance 在所有路径一致。
- Queue 扩成多类型(workflow_step/memory_touch/maintenance)后 app/server.ts 与 queue-consumer.ts 的分流逻辑变复杂,错误路由会静默丢消息,需在 handler 层对未知 type 显式抛错并测试。
- touch 异步回写与 sleep-time 衰减可能与读路径并发改 statement,需注意 last_accessed_at/access_count 的并发更新语义(D1 单写者下风险低,但 archive 与 touch 竞争需测)。

---

## P4 · 记忆面 — Agent-facing memory surface over MCP (memory verbs, fast write path, episodic capture, scope plumbing)

**目标**：Turn CloudMind's document-CRUD MCP into an agent-native memory surface: add the six self-editing memory verbs (remember/recall/update_memory/forget/reinforce/link) on top of the existing 15 tools, reusing withToolLogging + bearer-token auth + context profiles. Back remember() with a fast write path (embed+store+light index) that runs parallel to the heavy 11-step runNoteIngestWorkflow and skips the ~5 LLM enrichment steps. Extend recall with bi-temporal as_of + memory-type/scope scoping over search_assets_for_context. Wire the currently-dead 'chat' asset type into an episodic capture + chat answer write-back loop. Fix forget so it actually scrubs Vectorize vectors (the delete_asset ghost) and supports hard delete. Thread scope_id end-to-end at the schema/interface level while MVP only ever uses the single 'default' value (ADR-004). L2 is the full knowledge graph (ADR-001); L1 is a fresh rebuild with no data-migration script (ADR-003).

### 任务

- [ ] **P4-T1 · Add scope_id + agent_memory asset type + episodes table to D1 schema (fresh-rebuild migration)** — `M` · 依赖: —
  - **为什么**：ADR-004 requires scope_id to be present in the schema across L1/L2/L3 even though MVP uses only 'default'. The architecture's L1 瘦身 adds an episodes table (kind: ingest|chat_turn|agent_assert|correction) as the non-lossy time line that unifies all three write paths, and remember() needs a first-class memory asset type. ADR-003 means we drop & recreate rather than write data migrations. This is the data-layer foundation every other P4 task depends on.
  - **改动**：
    - src/platform/db/d1/schema/assets.ts — add "agent_memory" to assetTypeValues enum; add scopeId text column (notNull default 'default') + index
    - src/platform/db/d1/schema/episodes.ts — NEW drizzle table: id, scopeId(default 'default'), kind enum(ingest|chat_turn|agent_assert|correction), assetId(nullable FK), rawText/rawR2Key, occurredAt, recordedAt, actor; indexes on scopeId, assetId, occurredAt
    - src/platform/db/d1/schema/asset-chunks.ts — add scopeId column (default 'default') for scope-scoped vector cleanup/recall
    - src/platform/db/d1/schema/index.ts — export episodes table
    - src/features/assets/model/types.ts — extend AssetType union with 'agent_memory'; add scopeId to AssetSummary/AssetDetail and DEFAULT_SCOPE_ID constant; add memoryType/scopeId to AssetSearchFilters
    - src/core/scope/constants.ts — NEW: export DEFAULT_SCOPE_ID = 'default' as single source of truth (referenced everywhere scope is plumbed)
    - drizzle/00XX_*.sql — generated via npm run db:generate (NOT hand-written)
  - **验收**：
    - npm run db:generate produces a new migration adding scope_id, agent_memory enum value, and the episodes table with no drift errors
    - npm run typecheck passes with AssetType including 'agent_memory' and scopeId present on Asset types
    - DEFAULT_SCOPE_ID constant is imported (not string-literal duplicated) by every later P4 task that writes scope
    - wrangler d1 migrations apply DB --local succeeds against a fresh DB

- [ ] **P4-T2 · Episode + agent_memory repository ports and D1 implementation (with scope-aware vector id helper)** — `M` · 依赖: P4-T1
  - **为什么**：remember(), forget(), and episodic capture all need to create/read episodes and agent_memory assets and to enumerate vector ids for scrubbing. The existing AssetIngestRepository.createTextAsset hard-codes type 'note' and has no scope; we need a parallel create path that sets type=agent_memory + scopeId, plus episode CRUD and a listChunkVectorIdsByAssetId reader so forget can find ghosts. createChunkVectorId already gives a stable id scheme to reuse.
  - **改动**：
    - src/core/memory/ports.ts — NEW: EpisodeRepository (createEpisode, listEpisodesByScope) and CreateMemoryAssetInput (text, memoryType, scopeId, ttl?)
    - src/core/assets/ports.ts — add createMemoryAsset(input) to AssetIngestRepository; add listChunkVectorIdsByAssetId(assetId) and hardDeleteAsset(id) to AssetMutationRepository
    - src/core/vector/keys.ts — keep createChunkVectorId; vector ids for memory chunks reuse the same assetId:index scheme so cleanup is uniform
    - src/platform/db/d1/repositories/d1-asset-repository.ts — implement createMemoryAsset (type 'agent_memory', scopeId), listChunkVectorIdsByAssetId (SELECT vectorId FROM assetChunks WHERE assetId), hardDeleteAsset (delete chunks+facets+assertions+sources+asset rows)
    - src/platform/db/d1/repositories/d1-episode-repository.ts — NEW EpisodeRepository implementation
    - src/platform/db/d1/repositories/get-episode-repository.ts — NEW binding-to-repo factory mirroring get-asset-repository.ts
  - **验收**：
    - createMemoryAsset inserts an asset row with type='agent_memory' and scopeId set to the provided value (default 'default')
    - listChunkVectorIdsByAssetId returns the same ids createChunkVectorId produced during indexing (unit test with a seeded asset)
    - hardDeleteAsset removes the asset row and all child rows (chunks/facets/assertions/sources) in one logical operation
    - npm run typecheck passes; new ports are wired through AssetRepository composite type

- [ ] **P4-T3 · Fast write path: embed+store+light index, parallel to runNoteIngestWorkflow, skipping the LLM enrichment steps** — `L` · 依赖: P4-T2
  - **为什么**：The memory-verb table says remember() does '快写：episode→抽取→调和，跳过重 enrichment'. The heavy note workflow (shared-workflow-steps.ts buildSharedIngestSteps) runs 11 steps, ~5 of which are LLM/heuristic enrichment (summarize+title, derive_descriptor, derive_access_policy, derive_facets, derive_assertions). The fast path must reuse only the deterministic content→chunk→embed→index→finalize spine (persistProcessedContent, createChunkEmbeddings, indexPreparedChunks from content-processing.ts) so an agent write returns immediately, while still creating an L1 episode + agent_memory asset that recall can find. Runs alongside (not replacing) runNoteIngestWorkflow so doc ingest stays heavy.
  - **改动**：
    - src/features/memory/server/fast-write.ts — NEW: runFastMemoryWrite(repository, episodeRepo, blobStore, vectorStore, aiProvider, {text, memoryType, scopeId, ttl?}) → create episode(kind=agent_assert) + createMemoryAsset → normalizeContent → persistProcessedContent → createChunkEmbeddings → indexPreparedChunks → completeAssetProcessing + replaceAssetChunks; NO summarize/descriptor/facets/assertions LLM calls
    - src/features/memory/server/service.ts — NEW memory service exposing remember(bindings, input) that orchestrates fast-write and returns the asset snapshot + episodeId
    - src/features/ingest/server/content-processing.ts — reuse exported persistProcessedContent/createChunkEmbeddings/indexPreparedChunks (no change unless a memory-summary fallback title is needed; set title from first N chars of text)
    - tests/unit/features/memory/server/fast-write.test.ts — NEW: assert AI provider is called ONLY for embeddings (createEmbeddings) and never for generateText, proving enrichment is skipped
  - **验收**：
    - runFastMemoryWrite creates exactly one episode row and one agent_memory asset, persists chunks, and upserts vectors using createChunkVectorId ids
    - Unit test verifies aiProvider.generateText is NOT invoked (0 LLM enrichment calls) while createEmbeddings IS invoked
    - Returned asset reaches status 'ready' synchronously without enqueuing the note workflow
    - scopeId from input is stamped on the episode, asset, and chunk rows (default 'default')

- [ ] **P4-T4 · Fix forget: scrub Vectorize vectors (delete_asset ghost) + add hard delete, scope-aware** — `M` · 依赖: P4-T2
  - **为什么**：softDeleteAsset in d1-asset-repository.ts only sets deletedAt and never calls vectorStore.deleteByIds, so vectors stay queryable (the architecture's 🐛 ghost). forget(id|query, hard?) must (a) on soft delete also delete the asset's chunk vectors from Vectorize, and (b) on hard=true call hardDeleteAsset to remove rows entirely. VectorStore.deleteByIds and listChunkVectorIdsByAssetId (P4-T2) give us exactly what's needed; indexPreparedChunks already proves the vector-id enumeration pattern.
  - **改动**：
    - src/features/assets/server/service.ts — change deleteAsset to: read chunk vectorIds via listChunkVectorIdsByAssetId, vectorStore.deleteByIds(those), then softDeleteAsset; add hardDeleteAsset(bindings,id) that deletes vectors then repository.hardDeleteAsset
    - src/features/memory/server/service.ts — add forget(bindings, {id?, query?, hard?, scopeId?}): resolve id (direct or via recall-style top-1 query match within scope), then call delete/hard-delete and remove blob/episode linkage as needed
    - src/platform/blob/r2/* — optionally delete content/raw R2 objects on hard delete (best-effort)
    - tests/unit/features/assets/server/service.test.ts — extend: assert vectorStore.deleteByIds is called with the asset's vector ids on soft delete (regression for the ghost)
    - tests/unit/features/memory/server/forget.test.ts — NEW: hard=true removes asset rows + vectors; hard=false keeps row but scrubs vectors
  - **验收**：
    - After forget(id) (soft), vectorStore.deleteByIds is invoked with all of the asset's chunk vector ids (test-asserted) and the asset row is marked deleted
    - After forget(id, hard=true), the asset row and all chunk rows are gone AND the vectors are deleted
    - forget(query) resolves to the best in-scope match and deletes it; no match returns a structured TOOL_ERROR, not a throw
    - Existing delete_asset tool now also scrubs vectors (no behavior regression in its tests)

- [ ] **P4-T5 · recall extensions: bi-temporal as_of + memory-type/scope scoping over search_assets_for_context** — `M` · 依赖: P4-T1
  - **为什么**：The verb table maps recall(query, scope, as_of?) to '扩 search_assets_for_context' with time travel over the bi-temporal fields. For the P4 MVP (L2 graph tables land in P2/P3), as_of is applied as a recorded-at/captured-at upper bound and scope/memory-type as hard filters on the existing search path, so the interface is correct and forward-compatible with statements' valid_from/valid_until. This reuses searchAssetsForContext and the AssetSearchFilters plumbing extended in P4-T1.
  - **改动**：
    - src/features/search/server/service.ts — extend searchAssetsForContext to honor scopeId and memoryType (asset.type='agent_memory') filters and an asOf upper bound (createdAt/capturedAt <= asOf) passed through AssetSearchInput
    - src/features/search/server/schemas.ts — add scopeId (default 'default'), memoryType, asOf (ISO datetime) to assetSearchFiltersRawSchema
    - src/platform/db/d1/repositories/d1-asset-repository.ts — apply scopeId/asOf predicates in searchAssets/searchAssetSummaries WHERE clauses
    - src/features/memory/server/service.ts — add recall(bindings, {query, scope?, asOf?, profile?}) delegating to searchAssetsForContext with the memory-scoped policy
    - tests/unit/features/search/server/service.test.ts — extend: asOf excludes assets recorded after the cutoff; scopeId filters to in-scope assets only
  - **验收**：
    - recall with asOf returns only memories whose recorded/captured time is <= as_of (test-asserted)
    - recall with scope='default' returns default-scope memories; a non-default scope (even if unused in MVP) is accepted by the schema without error (interface present)
    - memoryType filter narrows results to agent_memory assets when requested
    - Existing search_assets_for_context behavior is unchanged when the new params are omitted

- [ ] **P4-T6 · update_memory + reinforce + link verbs (service layer)** — `M` · 依赖: P4-T3
  - **为什么**：The verb table maps update_memory(id, patch) to '扩 update_asset' (edit fact content/validity), reinforce(id) to a new write-back that bumps salience/last-accessed, and link(a, rel, b) to an explicit edge insert. For the P4 MVP, update_memory reuses updateAsset metadata; reinforce records an access bump (access_count/last_accessed surrogate on the asset until L2 salience lands in P3); link writes an episode of kind=agent_assert capturing the (a, rel, b) triple so it is non-lossily recorded now and can be promoted to a real L2 edge later. This keeps the full verb surface present without prematurely depending on the P3 graph tables.
  - **改动**：
    - src/features/memory/server/service.ts — add updateMemory(id, patch) (delegates to updateAsset + optional validity/ttl fields), reinforce(id) (increment access surrogate + touch updatedAt/last-accessed), link(a, rel, b, scopeId?) (createEpisode kind=agent_assert with structured triple payload)
    - src/core/assets/ports.ts — add touchAssetAccess(id) (or reuse updatedAt) for reinforce; document that full salience lives in P3
    - src/platform/db/d1/repositories/d1-asset-repository.ts — implement touchAssetAccess
    - tests/unit/features/memory/server/verbs.test.ts — NEW: update_memory edits title/summary; reinforce updates the access surrogate; link records an episode triple
  - **验收**：
    - update_memory(id, patch) updates the agent_memory asset and returns the new snapshot; rejects unknown ids with structured error
    - reinforce(id) bumps the access/last-accessed surrogate (test-asserted) without re-running any workflow
    - link(a, rel, b) creates an episode capturing the triple within the given scope (default)
    - npm run typecheck + the new unit tests pass

- [ ] **P4-T7 · Episodic capture for chat: wire the dead 'chat' asset type, capture turns, and write back the answer** — `M` · 依赖: P4-T3
  - **为什么**：The gap table says 'chat 对库只读' — chat answers never become memory and the 'chat' asset type is dead. P4 must capture each conversation turn as an L1 episode (kind=chat_turn) and write the grounded answer back as a memory so future recall benefits. The hook is the chat service executeAskLibrary result (answer + sources) returned through /api/chat; after producing the answer we create a chat_turn episode and, when the answer is grounded (answerMode grounded_answer), persist it via the fast write path (P4-T3) as a chat-typed memory. This closes the write-back loop without touching the heavy ingest workflow.
  - **改动**：
    - src/features/chat/server/service.ts — after a successful grounded answer, fire-and-forget capture: createEpisode(kind=chat_turn, rawText=question+answer) and optionally runFastMemoryWrite for the answer; gate on answerMode==='grounded_answer' and a captureEnabled flag
    - src/features/chat/server/routes.ts — pass through a capture flag (default on) and ensure capture errors never fail the response
    - src/features/memory/server/service.ts — expose captureChatTurn(bindings, {question, answer, sources, scopeId?}) reused by the chat service
    - src/features/assets/model/types.ts — confirm 'chat' AssetType is used for written-back chat memories (already in enum; now actually populated)
    - tests/unit/features/chat/server/service.test.ts — extend: a grounded answer triggers captureChatTurn exactly once; a fallback/no-context answer does NOT write back; capture failure does not throw
  - **验收**：
    - A grounded /api/chat answer creates one chat_turn episode and one chat-typed memory asset retrievable by recall
    - Fallback / rejected-context answers do NOT write back (test-asserted)
    - Capture is best-effort: an injected capture error leaves the chat response unaffected (test-asserted)
    - scopeId (default) is stamped on the captured episode and memory

- [ ] **P4-T8 · Register the six memory-verb MCP tools (remember/recall/update_memory/forget/reinforce/link) reusing withToolLogging + token auth** — `M` · 依赖: P4-T3, P4-T4, P4-T5, P4-T6
  - **为什么**：The verb table's whole point is the MCP surface. The existing 15 document-CRUD tools stay; we add six tools in createMcpServer wired through the same withToolLogging wrapper, createToolResult/createToolErrorResult helpers, getErrorMessage, and the bearer-token auth already enforced in routes.ts — no new transport or auth needed. Each tool delegates to the memory service (P4-T3/T4/T5/T6) with zod input schemas mirroring the verb signatures and scope defaulting to DEFAULT_SCOPE_ID. This is the integration capstone.
  - **改动**：
    - src/features/mcp/server/service.ts — add zod schemas (rememberInputSchema{text,type,scope?,ttl?}, recallInputSchema{query,scope?,asOf?,profile?}, updateMemoryInputSchema{id,patch}, forgetInputSchema{id?|query?,hard?,scope?}, reinforceInputSchema{id}, linkInputSchema{a,rel,b,scope?}); register 6 tools via server.registerTool(...withToolLogging(name, handler)) calling the memory service; default scope to DEFAULT_SCOPE_ID
    - src/features/mcp/server/service.ts — imports from src/features/memory/server/service.ts (remember/recall/updateMemory/forget/reinforce/link)
    - src/features/mcp/server/context-profiles.ts — reuse for recall's profile param (no change)
    - tests/unit/features/mcp/server/service.test.ts (or new) — assert all 21 tools register; remember/recall/forget happy-path returns createToolResult shape; forget on missing id returns isError with TOOL_ERROR; scope defaults to 'default' when omitted
  - **验收**：
    - createMcpServer registers the original 15 tools PLUS the 6 memory verbs (21 total), all wrapped in withToolLogging
    - remember/recall/update_memory/forget/reinforce/link are callable end-to-end through the authenticated POST /mcp transport (token auth unchanged)
    - Omitting scope on any verb resolves to DEFAULT_SCOPE_ID (interface present, single value per ADR-004)
    - Tool errors return the standard isError/structuredContent envelope; npm run typecheck + tests pass

### 阶段完成标准（Exit Criteria）

- Six memory verbs (remember/recall/update_memory/forget/reinforce/link) are registered as MCP tools alongside the existing 15 document-CRUD tools (21 total), all reusing withToolLogging + bearer-token auth + context profiles
- remember() persists via a fast write path that creates an L1 episode + agent_memory asset and embeds/indexes chunks WITHOUT invoking any of the LLM enrichment steps, running parallel to (not replacing) runNoteIngestWorkflow — proven by a test asserting 0 generateText calls
- recall() supports bi-temporal as_of (recorded/captured upper bound) plus memory-type and scope scoping layered on search_assets_for_context, with existing behavior unchanged when new params are omitted
- Grounded chat answers are captured as chat_turn episodes and written back as chat-typed memories retrievable by recall; fallback answers are not written back; capture failures never break the chat response
- forget() scrubs the asset's Vectorize vectors on every delete (fixing the delete_asset ghost) and supports hard delete that removes asset + child rows entirely — both paths test-asserted
- scope_id is threaded through schema, repositories, search filters, episodes, and every memory verb, but MVP resolves to the single DEFAULT_SCOPE_ID value (ADR-004); fresh-rebuild migration generated via drizzle-kit with no hand-written data migration (ADR-003)
- npm run typecheck, npm run lint, and npm run test all pass; wrangler d1 migrations apply succeeds on a fresh DB

### 风险

- Non-transactional D1 + Vectorize: fast write (asset row + chunks + vector upsert) and forget (row delete + vector delete) can partially fail, leaving vector/row drift. Mitigation: order operations so vectors are deleted before/with row deletion and make writes idempotent by stable createChunkVectorId; a P3 sleep-time repair job can reconcile drift.
- ADR-003 fresh rebuild: adding scope_id/agent_memory/episodes via drop-and-recreate will wipe any existing local/remote data; must coordinate that deployers re-ingest (raw assets replayable from R2). Avoid hand-editing generated SQL.
- L2 graph tables (entities/statements/edges) are P2/P3, so update_memory validity-edits, reinforce salience, and link edges are MVP surrogates (episodes/asset fields) here; risk of interface churn when real L2 lands — mitigate by keeping verb signatures graph-ready (triples, valid_from/until accepted but stored as episode payload for now).
- Chat write-back can create memory bloat / feedback loops (re-recalling self-written answers). Mitigation: gate write-back strictly on answerMode==='grounded_answer', tag chat memories distinctly, and keep capture best-effort/fire-and-forget so it never blocks responses.
- remember() fast path skips access-policy/aiVisibility derivation, so agent-written memories default to aiVisibility='allow' and could leak into broad recall unintentionally. Mitigation: set conservative defaults for agent_memory and allow an explicit visibility/ttl in the remember input.
- Scope plumbing touches many schemas/repositories/filters; risk of missing one path and silently dropping the scope predicate. Mitigation: centralize DEFAULT_SCOPE_ID and add tests asserting scope is stamped on episode/asset/chunk and honored in recall filters.

---

## X · Cross-cutting / Foundations (eval, fresh-rebuild rollout, testing, quality gates, versioning, observability, docs)

**目标**：Stand up the shared engineering scaffolding that every memory-layer phase (P1-P4) depends on: a reusable retrieval eval harness that gates retrieval changes, a fresh-rebuild rollout playbook (drop/recreate D1 + Vectorize-with-metadata-indexes + R2 replay) wired into one-click-deploy and wrangler bindings, an explicit testing strategy (unit coverage for fusion/reranker/graph/reconciliation + port contract tests), CI quality gates (typecheck/lint/test + eval-regression), a versioning & release cadence that reconciles package.json with the just-tagged v0.3, observability extended from search_completed to fusion/rerank/graph/recall and the sleep-time jobs, and a docs/ADR upkeep loop keeping architecture + roadmap in sync. This track spans all phases and has no functional retrieval logic of its own; it provides the gates and tooling the other tracks plug into.

### 任务

- [ ] **X-T1 · Reconcile project version with the v0.3 tag and define the SemVer + git-tag release cadence** — `S` · 依赖: —
  - **为什么**：package.json still reads version 0.1.0 while commit a89b712 was just tagged v0.3 — a silent drift that makes the version field meaningless as a release marker. Before any phase work lands we need one written policy: when to bump package.json minor (per memory-layer phase P1-P4), how phase deliverables map to git tags, and that the tag is the source of truth while package.json is bumped in the same commit. This anchors every later 'release' step in the other tracks.
  - **改动**：
    - package.json — bump "version" from 0.1.0 to 0.3.0 to match tag v0.3 (a89b712); keep field in sync with tags going forward
    - docs/RELEASING.md (new) — SemVer policy: minor bump per shipped roadmap phase (P1->0.4, P2->0.5, ...), patch for fixes; git tag vX.Y on the phase-completing commit is authoritative; package.json bumped in the same commit; pre-1.0 = pre-stable contract
    - docs/superpowers/roadmap.md — add a 'Versioning & release cadence' subsection linking RELEASING.md and the phase->version map
  - **验收**：
    - package.json version equals the latest git tag's version (0.3.0) and `git describe --tags` agrees
    - docs/RELEASING.md states the phase->minor-bump map (P1..P4 -> 0.4..0.7) and that git tag is source of truth, package.json bumped in same commit
    - roadmap.md references RELEASING.md and no other doc claims a different current version

- [ ] **X-T2 · Create the eval harness as a first-class reusable fixture: golden queries + retrieval metrics (recall@k / MRR / nDCG)** — `M` · 依赖: —
  - **为什么**：The architecture names a 'minimal eval harness' as a P1 deliverable and ADR-002 makes retrieval the load-bearing wall — but there is no place for it today. Make it a first-class fixture under tests/ so every retrieval change (fusion, rerank, graph, prefixes) is scored against the same golden set. Pure-function metrics live in src/core so they are unit-testable and reusable by both vitest and the CI gate; the golden corpus + expected relevance judgments live as committed fixtures.
  - **改动**：
    - src/core/eval/ports.ts (new) — types: GoldenQuery { id, query, scopeId, relevantDocIds[] }, RetrievalRun { queryId, rankedDocIds[] }, MetricResult { recallAtK, mrr, ndcg } and an EvalReport aggregate (mean per metric + per-query rows)
    - src/core/eval/metrics.ts (new) — pure functions recallAtK(ranked, relevant, k), mrr(ranked, relevant), ndcg(ranked, relevant, k); no I/O, no bindings
    - src/core/eval/run-eval.ts (new) — given a retrieve(query)->rankedDocIds callback + golden set, produce an EvalReport; deterministic ordering, scope_id threaded (default-scope only per ADR-004)
    - tests/fixtures/eval/golden-queries.json (new) — initial golden set (>=15 queries incl. CJK queries to exercise the FTS5/trigram path; relevance judgments referencing R2-replayable seed assets)
    - tests/fixtures/eval/README.md (new) — how to add a golden query + judgment, and the metric definitions
  - **验收**：
    - src/core/eval/metrics.ts exports recallAtK/mrr/ndcg as pure functions with no imports from @/platform or @/features
    - tests/fixtures/eval/golden-queries.json parses and validates against the GoldenQuery type (zod or tsc) and contains >=15 queries including >=3 CJK queries
    - run-eval.ts produces a stable EvalReport for a fixed retrieve callback (same input -> byte-identical JSON report)
    - scope_id is present on every GoldenQuery and defaults to the default scope

- [ ] **X-T3 · Wire the eval harness into a runnable script + npm command so it can gate retrieval changes locally and in CI** — `M` · 依赖: X-T2
  - **为什么**：The harness fixture (X-T2) needs an executable entrypoint that runs the real retrieval path against the golden set and emits a JSON report + a pass/fail vs a committed baseline. This is what the eval-regression gate (X-T8) consumes. Following the repo convention, ship it as a Node script under scripts/ plus an npm script, mirroring one-click-deploy.mjs style.
  - **改动**：
    - scripts/run-eval.mjs (new) — load golden-queries.json, invoke the retrieval entrypoint (against a local/mocked store for CI determinism), write tests/fixtures/eval/baseline.json on --update and otherwise diff current metrics vs baseline with a configurable tolerance
    - tests/fixtures/eval/baseline.json (new) — committed metric baseline (mean recall@k/MRR/nDCG) the gate compares against
    - package.json — add scripts "eval": "node scripts/run-eval.mjs" and "eval:update": "node scripts/run-eval.mjs --update"
    - src/core/eval/run-eval.ts — export the entrypoint used by both vitest and scripts/run-eval.mjs (single source of truth)
  - **验收**：
    - `npm run eval` exits 0 when current metrics are within tolerance of baseline.json and non-zero when any metric regresses beyond tolerance
    - `npm run eval:update` rewrites baseline.json deterministically
    - the script reuses src/core/eval/run-eval.ts (no duplicated metric logic) and threads default scope_id
    - running with no network/bindings succeeds (uses the mock/in-memory retrieval path)

- [ ] **X-T4 · Author the FRESH-rebuild rollout playbook (drop & recreate D1 + Vectorize-with-metadata-indexes + R2 replay)** — `M` · 依赖: X-T3
  - **为什么**：ADR-003 locks 'new DB, no migration script'; the L1 reshape (P2) and re-embed (P1) require dropping & recreating D1 and the Vectorize index. Critically, Vectorize metadata indexes MUST be declared before any upsert (the architecture's 'native metadata filter' claim depends on this), and L1 raw assets in R2 are the replay source to re-ingest. Capture this as an ordered, copy-pasteable playbook so the destructive rollout is repeatable and safe.
  - **改动**：
    - docs/rollout-fresh-rebuild.md (new) — ordered steps: (1) export/confirm R2 raw assets are intact (non-destructive L1), (2) drop & recreate D1 (`wrangler d1 delete` + `create`) and re-apply drizzle migrations, (3) delete & recreate the Vectorize index, (4) create metadata indexes BEFORE first upsert (e.g. scope_id, asset type, ai_visibility, namespace) via `wrangler vectorize create-metadata-index`, (5) R2 replay/re-ingest to repopulate L1->L2->vectors, (6) run `npm run eval` to confirm parity
    - docs/rollout-fresh-rebuild.md — explicit ordering warning: metadata indexes are immutable-after-data and must exist before upsert; list the exact metadata keys the read path filters on
    - docs/superpowers/roadmap.md — link the playbook from the P1/P2 rows; note 'P1 re-embed precedes P2 migration' dependency from the architecture doc
  - **验收**：
    - playbook lists the exact wrangler commands in order and names every metadata-index key created before upsert
    - playbook states the metadata-index-before-upsert constraint and the R2-replay re-ingest path as the data source (no migration script, per ADR-003)
    - a final step runs the eval harness (X-T3) to validate the rebuilt index
    - roadmap P1/P2 rows link the playbook

- [ ] **X-T5 · Update scripts/one-click-deploy.mjs + wrangler.jsonc bindings for the fresh-rebuild (Vectorize metadata indexes, Cron Triggers, sleep-time queue)** — `L` · 依赖: X-T4
  - **为什么**：The current one-click-deploy creates a Vectorize index with NO metadata indexes, no Cron trigger, and a single workflows queue. The memory layer needs: metadata indexes declared at index-creation time (X-T4), a Cron Trigger for sleep-time jobs (architecture S9), and a dedicated sleep-time/maintenance queue separate from the ingest workflow queue. Bake these into the idempotent bootstrap so a from-scratch deploy lands the correct topology, and add the matching static bindings to wrangler.jsonc.
  - **改动**：
    - scripts/one-click-deploy.mjs — after `wrangler vectorize create`, add `wrangler vectorize create-metadata-index` calls for each filtered key (scope_id, type, ai_visibility) before any deploy/upsert; gate on success
    - scripts/one-click-deploy.mjs — create a second queue `${prefix}-maintenance` (sleep-time) and write its producer/consumer binding (e.g. MAINTENANCE_QUEUE) in ensureFinalConfig; keep existing WORKFLOW_QUEUE
    - wrangler.jsonc — add `triggers.crons` (e.g. a daily/hourly cron for sleep-time consolidation/forgetting), add the maintenance queue producer/consumer, document the metadata-index keys in a comment
    - src/env.ts — add MAINTENANCE_QUEUE?: Queue to AppBindings so the cron/queue handler can type it
    - app/server.ts — add a `scheduled(event, env, ctx)` handler stub that enqueues the sleep-time job onto MAINTENANCE_QUEUE (handler body owned by the sleep-time track; this task only wires the entrypoint + binding)
  - **验收**：
    - running one-click-deploy creates the Vectorize index AND its metadata indexes before deploy, and creates both the workflows and maintenance queues
    - wrangler.jsonc contains triggers.crons and a maintenance queue producer+consumer; `wrangler deploy --dry-run` validates the config
    - AppBindings includes MAINTENANCE_QUEUE and app/server.ts exports a `scheduled` handler that typechecks
    - the metadata-index keys created by the script exactly match the keys listed in docs/rollout-fresh-rebuild.md

- [ ] **X-T6 · Define the testing strategy: unit coverage targets for new fusion/reranker/graph/reconciliation logic** — `M` · 依赖: —
  - **为什么**：The new core algorithms (RRF fusion, bge-reranker ordering, graph recursive-CTE traversal, mem0-style ADD/UPDATE/DELETE/NOOP reconciliation) are pure-decision logic where a unit-test gap directly translates to silent retrieval/memory corruption. Write down where each module's tests live (mirroring the tests/unit/** layout) and the expected coverage so every track adds tests with its code rather than after. This is a strategy/convention task plus a vitest coverage config, not the implementations.
  - **改动**：
    - vitest.config.ts — enable coverage (provider v8) with thresholds scoped to new core memory modules (e.g. src/core/eval/**, src/features/search/server/fusion/**, .../rerank/**, src/core/graph/**, reconciliation modules) and a global floor that does not regress existing files
    - docs/testing-strategy.md (new) — table mapping each new module -> test file path under tests/unit/** -> required cases: RRF fusion (rank-invariance, dimensionless merge, tie handling), reranker (order-preserving given scores, MMR de-dup), graph traversal (1/2/3-hop depth limit, cycle safety), reconciliation (each of ADD/UPDATE/DELETE/NOOP + bi-temporal expiry sets expired_at not delete)
    - docs/testing-strategy.md — note pure-function-first rule: decision logic in src/core (no bindings) so it is unit-testable without D1/Vectorize
    - package.json — add "test:coverage": "vitest run --coverage"
  - **验收**：
    - vitest.config.ts emits coverage and fails when the configured new-module thresholds are unmet
    - docs/testing-strategy.md enumerates the required test cases for fusion, rerank, graph traversal, and reconciliation with concrete tests/unit/** target paths
    - `npm run test:coverage` runs and reports coverage for the listed modules
    - the strategy states the pure-function-in-core rule so fusion/graph/reconciliation are testable without platform bindings

- [ ] **X-T7 · Add port contract tests for the core ports (VectorStore, AssetSearchRepository, WorkflowRepository, + new memory ports)** — `M` · 依赖: —
  - **为什么**：The codebase is built on hexagonal ports (src/core/**/ports.ts) with swappable D1/Vectorize adapters; the fresh-rebuild adds metadata-filtered Vectorize queries and new memory/graph ports. A reusable contract-test suite that any adapter (real or in-memory) must satisfy keeps the in-memory test doubles (used by the eval harness X-T3) behaviorally faithful to the Cloudflare adapters, preventing 'green tests, broken prod' drift.
  - **改动**：
    - tests/contract/vector-store.contract.ts (new) — shared describe-block exercising upsert/search/deleteByIds incl. metadata-filtered search and namespace isolation; parameterized over an adapter factory
    - tests/contract/asset-search-repository.contract.ts (new) — shared suite for term/summary/assertion/chunk-by-vector-id lookups
    - tests/contract/run-contract.test.ts (new) — instantiate the contract suites against the in-memory doubles (and, where a miniflare/local binding is available, the real adapters)
    - src/core/vector/ports.ts — extend VectorSearchInput with an optional metadata filter field so the contract can assert native filtering (aligns with the architecture's 'Vectorize native metadata filter' fact)
  - **验收**：
    - the same contract suite passes against the in-memory VectorStore double and asserts metadata-filtered search returns only matching records
    - VectorSearchInput exposes an optional metadata-filter field and VectorizeStore maps it to the Vectorize query filter
    - contract suites are reusable (exported describe factories) and invoked from run-contract.test.ts
    - `npm test` includes tests/contract/**

- [ ] **X-T8 · Establish CI quality gates: typecheck + lint + test + eval-regression in a GitHub Actions pipeline** — `M` · 依赖: X-T3, X-T6, X-T7
  - **为什么**：There is no .github/ CI today; the gates exist only as local npm scripts and the roadmap's acceptance criteria reference pnpm even though the repo uses npm. Codify a single pipeline that runs the existing typecheck/lint/test and adds the eval-regression gate (X-T3) so no retrieval change merges without passing golden-query metrics. This is the enforcement layer that makes ADR-002 ('retrieval is the load-bearing wall') real.
  - **改动**：
    - .github/workflows/ci.yml (new) — jobs running `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test`, then `npm run eval` (eval-regression gate) on PRs and main; correct npm (not pnpm) usage
    - .github/workflows/ci.yml — cache node_modules; fail the pipeline if eval metrics regress beyond tolerance
    - docs/superpowers/roadmap.md — replace the pnpm-based acceptance snippet with the actual npm commands and add the eval gate to the per-batch checklist
    - docs/RELEASING.md — note that a tag is only cut from a green pipeline including the eval gate
  - **验收**：
    - .github/workflows/ci.yml runs typecheck, lint, test, and eval on PRs and on main using npm
    - the eval job fails the build when baseline.json metrics regress beyond tolerance
    - roadmap acceptance section uses npm commands (not pnpm) and lists the eval gate
    - a deliberately regressed golden result causes CI to go red (demonstrated once)

- [ ] **X-T9 · Extend structured observability from search_completed to fusion/rerank/graph/recall and the sleep-time jobs** — `M` · 依赖: —
  - **为什么**：Today only search_completed is logged (src/features/search/server/service.ts) via the structured JSON logger. The new read path (parallel recall -> RRF -> rerank -> graph -> salience) and the sleep-time maintenance jobs are opaque without per-stage metrics, which also feed the eval/regression story. Extend the existing createLogger(scope) convention with a small set of well-typed events and stage timings — no new logging framework, just consistent fields.
  - **改动**：
    - src/core/logging/ports.ts — add an optional typed metric helper (e.g. a RetrievalStageFields shape: stage, durationMs, candidateCount, scopeId) reused across events to keep field names stable
    - src/features/search/server/service.ts — emit per-stage events (recall_completed per source, fusion_completed with input/output counts, rerank_completed with kept/dropped, graph_traversal_completed with hops/nodes) alongside the existing search_completed; include scope_id
    - src/features/workflows/server/* (sleep-time job module) — emit consolidation_completed / forgetting_completed / reconciliation_replayed events with counts and durationMs for the Cron-driven maintenance jobs
    - docs/observability.md (new) — catalog of structured events, their fields, and which stage emits them; note these are the metrics the eval-regression gate and dashboards rely on
  - **验收**：
    - search service emits distinct structured events for recall, fusion, rerank, and graph stages, each with durationMs + counts + scopeId, in addition to search_completed
    - sleep-time job module emits consolidation/forgetting/reconciliation events with counts and durationMs
    - all events use createLogger(scope) and the shared field shape (no ad-hoc field names) and pass the logger unit-test style assertions
    - docs/observability.md lists every new event and its fields

- [ ] **X-T10 · Set up docs upkeep: ADR log file + architecture/roadmap sync rule** — `S` · 依赖: X-T3, X-T4, X-T5
  - **为什么**：ADRs currently live inline in docs/memory-layer-architecture.md (ADR-001..004) with no standalone log, and the roadmap and architecture can silently diverge. Extract a dedicated ADR log and a lightweight upkeep rule so every cross-cutting decision (e.g. eval baseline tolerance, cron cadence, metadata-index keys) is recorded once and the two docs stay in sync — preventing the version-drift class of bug (X-T1) from recurring at the design level.
  - **改动**：
    - docs/adr/README.md (new) — ADR index; migrate ADR-001..004 from the architecture doc into per-file entries docs/adr/0001-l2-full-knowledge-graph.md ... 0004-mvp-default-scope-only.md, keeping the architecture doc linking to them
    - docs/adr/0005-fresh-rebuild-rollout.md (new) — record the metadata-index keys, cron cadence, and eval tolerance decided in X-T4/X-T5/X-T3 so they have a single authority
    - docs/memory-layer-architecture.md — replace the inline ADR section body with links to docs/adr/* (keep a one-line summary table)
    - docs/superpowers/roadmap.md — add an 'upkeep rule': any phase that changes scope/bindings/metrics must update the architecture doc, the roadmap row, and add/append an ADR in the same PR
  - **验收**：
    - docs/adr/ contains one file per ADR (0001-0005) and a README index; ADR-001..004 content matches the architecture doc's locked decisions
    - docs/memory-layer-architecture.md links to docs/adr/* instead of duplicating full ADR bodies
    - roadmap states the architecture+roadmap+ADR same-PR sync rule
    - the new ADR-0005 records metadata-index keys, cron cadence, and eval tolerance consistent with X-T3/X-T4/X-T5

### 阶段完成标准（Exit Criteria）

- `npm run eval` exists and scores the real retrieval entrypoint against a committed golden set with recall@k/MRR/nDCG, failing on regression beyond tolerance vs baseline.json
- A fresh-rebuild playbook (docs/rollout-fresh-rebuild.md) plus an updated scripts/one-click-deploy.mjs + wrangler.jsonc reproducibly drop & recreate D1 and the Vectorize index WITH metadata indexes declared before first upsert, provision the Cron Trigger + sleep-time queue, and re-ingest from R2
- Testing strategy is documented and enforced: vitest coverage thresholds for fusion/rerank/graph/reconciliation modules, and reusable port contract tests run against in-memory doubles (incl. metadata-filtered Vectorize search)
- A .github/workflows/ci.yml pipeline runs npm typecheck + lint + test + eval-regression on PRs and main, and a deliberate golden regression turns CI red
- package.json version equals the latest git tag (0.3.0) and docs/RELEASING.md defines the phase->minor-bump + git-tag-authoritative cadence
- Structured observability is extended from search_completed to per-stage recall/fusion/rerank/graph events and sleep-time consolidation/forgetting/reconciliation events, all using createLogger(scope) with a stable field shape, cataloged in docs/observability.md
- ADRs are extracted into docs/adr/* (0001-0005) with an upkeep rule that keeps architecture + roadmap + ADR in sync within the same PR
- scope_id is threaded through the eval fixtures, golden queries, metadata indexes, and observability fields, defaulting to the single default scope per ADR-004

### 风险

- Vectorize metadata indexes are immutable after data is written — if the metadata-index keys in one-click-deploy.mjs/wrangler.jsonc do not exactly match what the read path filters on, the only fix is another full index recreate; X-T4/X-T5 must lock the key list before any upsert.
- The fresh-rebuild is destructive (drop D1 + Vectorize). The playbook relies on R2 raw assets being the non-destructive replay source — if any L1 raw asset is missing or already mutated, re-ingest cannot fully reconstruct state. Verify R2 integrity before the drop step.
- Eval-harness determinism depends on Workers AI embeddings/reranker, which are remote and can drift; the CI eval gate must run against an in-memory/mocked retrieval path or pinned fixtures, or the regression gate will produce flaky false failures.
- package.json scripts use npm but the roadmap acceptance snippets reference pnpm; CI (X-T8) must standardize on one (npm) or the gate commands will silently no-op / fail.
- app/server.ts currently exports only fetch + queue; adding a scheduled handler and a second queue changes the worker's handler surface and bindings — a misconfigured consumer or missing binding can break deploys (validate with wrangler deploy --dry-run).
- Coverage thresholds set too high on modules that don't exist yet (fusion/graph/reconciliation) will fail CI before those tracks land; thresholds must be scoped to existing-or-added paths and ratcheted up as modules ship.
- Setting an eval baseline before P1 retrieval fixes land risks baking in today's known-bad recall as the 'pass' bar; baseline.json should be (re)captured immediately after P1 lands, and the cadence for refreshing it recorded in ADR-0005.

---
