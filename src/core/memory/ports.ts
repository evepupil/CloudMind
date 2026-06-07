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
  // 按 vector id 查实体（embed 消歧后回填用）。
  getEntityByVectorId(vectorId: string): Promise<MemoryEntity | null>;
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
  // —— 图检索读侧（T3）——
  // 把 ANN 命中的向量 id 解析为实体 id（图检索的种子解析）。
  findEntityIdsByVectorIds(vectorIds: string[]): Promise<EntityVectorRef[]>;
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
}
