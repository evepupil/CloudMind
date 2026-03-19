export interface VectorRecord {
  id: string;
  values: number[];
  metadataJson?: string | undefined;
}

export interface VectorSearchInput {
  values: number[];
  topK: number;
  namespace?: string | undefined;
}

export interface VectorSearchMatch {
  id: string;
  score: number;
  metadataJson?: string | undefined;
}

// 这里保留统一向量存储端口，后续可在 Vectorize 与 pgvector 间切换。
export interface VectorStore {
  upsert(records: VectorRecord[]): Promise<void>;
  search(input: VectorSearchInput): Promise<VectorSearchMatch[]>;
  deleteByIds(ids: string[]): Promise<void>;
}
