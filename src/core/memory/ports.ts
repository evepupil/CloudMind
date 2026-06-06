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
}
