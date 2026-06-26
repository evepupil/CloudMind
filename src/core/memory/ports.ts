// L2 语义记忆层（知识图谱）+ L1 情节流的写侧端口。
// 与基础设施实现解耦：业务层只依赖本接口，D1 实现可替换（未来 pg）。

export type EpisodeKind =
  | "ingest"
  | "chat_turn"
  | "agent_assert"
  | "correction";

export type MemoryKind = "statement" | "entity" | "edge";

export interface CreateEpisodeInput {
  scopeId?: string | undefined;
  kind: EpisodeKind;
  assetId?: string | null | undefined;
  rawText?: string | null | undefined;
  rawR2Key?: string | null | undefined;
  actor?: string | null | undefined;
  occurredAt?: string | null | undefined;
  recordedAt?: string | undefined;
}

export interface UpsertEntityInput {
  scopeId?: string | undefined;
  canonicalName: string;
  normalizedName: string;
  type?: string | null | undefined;
  embeddingVectorId?: string | null | undefined;
  seenAt?: string | undefined;
}

export interface MemoryEntity {
  id: string;
  scopeId: string;
  canonicalName: string;
  normalizedName: string;
  type: string | null;
  mentionCount: number;
}

// L2 陈述的读模型（带双时间四字段 + 显著性字段），供智能写调和与图检索消费。
export interface MemoryStatement {
  id: string;
  scopeId: string;
  subjectEntityId: string;
  predicate: string;
  objectEntityId: string | null;
  objectLiteral: string | null;
  nlText: string;
  confidence: number | null;
  importance: number;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  expiredAt: string | null;
  supersededById: string | null;
  lastAccessedAt: string | null;
  accessCount: number;
}

// 置某陈述失效的输入：写录入时 expired_at，并可用 superseded_by_id 指向取代它的新陈述。
export interface InvalidateStatementInput {
  statementId: string;
  supersededById?: string | null | undefined;
}

// 置匹配的活跃边失效的输入：按 (scope, src, dst, relation) 端点定位。
// 调和失效一条实体宾语的 statement 时，需同步失效其投影出的图边，避免图遍历读到陈旧关系。
export interface InvalidateEdgesInput {
  scopeId?: string | undefined;
  srcEntityId: string;
  dstEntityId: string;
  relation: string;
}

// L2 有向边读模型，供图遍历（BFS / 递归 CTE）消费。
export interface MemoryEdge {
  id: string;
  scopeId: string;
  srcEntityId: string;
  dstEntityId: string;
  relation: string;
}

// vector id ↔ 实体 id 映射，供图检索把 ANN 命中的种子向量解析为实体。
export interface EntityVectorRef {
  vectorId: string;
  entityId: string;
}

// 出处引用读模型（记忆 → L1 资产/情节）。供图证据钻取回 L1 原文引用。
export interface MemoryProvenanceRef {
  memoryId: string;
  assetId: string | null;
  episodeId: string | null;
  chunkIndex: number | null;
}

// 重复陈述引用：sleep-time 去重时，把冗余陈述（duplicateId）归档并指向保留者（retainId）。
export interface DuplicateStatementRef {
  duplicateId: string;
  retainId: string;
}

// —— 记忆层浏览读模型（Phase 5：GET /api/memory/* 供 UI 渲染）——

// 实体节点详细读模型（比图检索用的 MemoryEntity 多带显著性/时间字段，供图谱与详情展示）。
export interface MemoryGraphEntity {
  id: string;
  scopeId: string;
  canonicalName: string;
  type: string | null;
  salience: number;
  mentionCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
}

// 浏览用有向边（带关系名，全图列出而非按 src 过滤）。
export interface MemoryGraphEdge {
  id: string;
  scopeId: string;
  srcEntityId: string;
  dstEntityId: string;
  relation: string;
}

// L2 计数快照（Overview 计量条 + 记忆层概览）。
export interface MemoryGraphCounts {
  entities: number;
  statements: number;
  edges: number;
}

// listStatements 的过滤/分页选项。
export interface ListStatementsOptions {
  scopeId?: string | undefined;
  subjectEntityId?: string | undefined;
  // 是否包含已失效（expired_at 非空）的陈述；时间线视图需要看完整历史。
  includeExpired?: boolean | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

// listEntities 的过滤/分页选项。
export interface ListEntitiesOptions {
  scopeId?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface CreateStatementInput {
  scopeId?: string | undefined;
  subjectEntityId: string;
  predicate: string;
  // 宾语二选一：实体（构成图边）或字面值（属性事实）。
  objectEntityId?: string | null | undefined;
  objectLiteral?: string | null | undefined;
  nlText: string;
  embeddingVectorId?: string | null | undefined;
  confidence?: number | null | undefined;
  importance?: number | undefined;
  validFrom?: string | null | undefined;
  validUntil?: string | null | undefined;
}

export interface CreateEdgeInput {
  scopeId?: string | undefined;
  srcEntityId: string;
  dstEntityId: string;
  relation: string;
  weight?: number | undefined;
  confidence?: number | null | undefined;
  validFrom?: string | null | undefined;
  validUntil?: string | null | undefined;
}

export interface AddProvenanceInput {
  scopeId?: string | undefined;
  memoryType: MemoryKind;
  memoryId: string;
  episodeId?: string | null | undefined;
  assetId?: string | null | undefined;
  chunkIndex?: number | null | undefined;
  span?: string | null | undefined;
}

// 向量消歧阈值（对标 metadata_terms 机制）：
//   cosine >= 0.86 → 视为同一实体，合并（bump mention_count + 补 type/alias）。
//   cosine >= 0.72 但 < 0.86 → 存疑，暂不合并（留给 LLM 调和，P3）。
//   cosine < 0.72 → 不同实体，新建。
export const ENTITY_MERGE_THRESHOLD = 0.86;
export const ENTITY_SUSPECT_THRESHOLD = 0.72;

export interface VectorMatch {
  id: string;
  score: number;
}

// L2 写侧仓储：实体幂等去重 + 陈述/关系/出处写入 + L1 情节写入。
export interface MemoryRepository {
  createEpisode(input: CreateEpisodeInput): Promise<{ id: string }>;
  // 按 (scope, normalized_name) 幂等：已存在则 bump mention_count + last_seen，否则新建。
  upsertEntityByNormalizedName(input: UpsertEntityInput): Promise<MemoryEntity>;
  // 按 vector id 查实体（embed 消歧后回填用）；带 scope 防跨 scope 误取。
  getEntityByVectorId(
    vectorId: string,
    scopeId?: string | undefined
  ): Promise<MemoryEntity | null>;
  // 更新实体的向量 id。
  setEntityVectorId(entityId: string, vectorId: string): Promise<void>;
  createStatement(input: CreateStatementInput): Promise<{ id: string }>;
  createEdge(input: CreateEdgeInput): Promise<{ id: string }>;
  addProvenance(input: AddProvenanceInput): Promise<void>;
  // 查某主语下所有仍有效（expired_at 空）的陈述，作为智能写调和的候选集（按 created_at 升序）。
  findActiveStatementsBySubject(
    subjectEntityId: string,
    scopeId?: string | undefined
  ): Promise<MemoryStatement[]>;
  // 按 id 查单条陈述（含已失效），主要供调和落库后核对与测试用。
  getStatementById(statementId: string): Promise<MemoryStatement | null>;
  // 置某陈述失效（双时间：expired_at=now），可指向取代它的新陈述。
  invalidateStatement(input: InvalidateStatementInput): Promise<void>;
  // 置匹配端点的活跃边失效（与 statement 调和同步，避免 edges 表残留陈旧关系）。
  invalidateActiveEdges(input: InvalidateEdgesInput): Promise<void>;
  // 检索命中强化：批量 bump 陈述的 access_count(+1) 与 last_accessed_at（访问写回闭环）。
  bumpStatementAccess(statementIds: string[]): Promise<void>;
  // —— 图检索读侧（T3）——
  // 把 ANN 命中的向量 id 解析为实体 id（图检索的种子解析）；按 scope 隔离。
  findEntityIdsByVectorIds(
    vectorIds: string[],
    scopeId?: string | undefined
  ): Promise<EntityVectorRef[]>;
  // 取一批源实体的未失效出边，作为 BFS / 递归遍历的一跳。
  findActiveOutgoingEdges(
    srcEntityIds: string[],
    scopeId?: string | undefined
  ): Promise<MemoryEdge[]>;
  // 取一批主语实体下所有未失效的陈述（图证据事实集）。
  findActiveStatementsBySubjects(
    subjectEntityIds: string[],
    scopeId?: string | undefined
  ): Promise<MemoryStatement[]>;
  // 按记忆 id 批量取出处（钻取回 L1 资产）。
  findProvenanceByMemoryIds(
    memoryType: MemoryKind,
    memoryIds: string[]
  ): Promise<MemoryProvenanceRef[]>;
  // —— sleep-time 修复（T5）——
  // 漂移边：仍活跃、但已无任一活跃 statement 与其 (scope,src,relation,dst) 对应的边。
  findDriftedEdges(scopeId?: string | undefined): Promise<MemoryEdge[]>;
  // 重复活跃陈述：同 (scope,subject,predicate,object) 的多条活跃陈述，保留最早、其余应归档。
  findDuplicateActiveStatements(
    scopeId?: string | undefined
  ): Promise<DuplicateStatementRef[]>;
  // —— 记忆层浏览读侧（Phase 5：供 GET /api/memory/* 渲染 UI）——
  // 列出实体（按显著性降序），供图谱与实体面板。
  listEntities(options?: ListEntitiesOptions): Promise<MemoryGraphEntity[]>;
  // 按 id 取单个实体详情。
  getEntityById(entityId: string): Promise<MemoryGraphEntity | null>;
  // 列出活跃边（全图，按 scope），供图谱连线。
  listActiveEdges(scopeId?: string | undefined): Promise<MemoryGraphEdge[]>;
  // 列出陈述（可含失效、可按主语过滤、按 created_at 降序），供事实/时间线。
  listStatements(options?: ListStatementsOptions): Promise<MemoryStatement[]>;
  // L2 计数快照（entities/statements/edges 的活跃计数）。
  countGraph(scopeId?: string | undefined): Promise<MemoryGraphCounts>;
}
