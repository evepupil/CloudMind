export interface VectorRecord {
  id: string;
  values: number[];
  namespace?: string | undefined;
  metadataJson?: string | undefined;
}

// 这里描述 Vectorize 原生 metadata 过滤条件（在 ANN topK 之前生效），
// 标量等价于 $eq；对象形式支持 $eq/$ne/$in/$nin 与范围比较。
export type VectorFilterCondition =
  | string
  | number
  | boolean
  | {
      $eq?: string | number | boolean;
      $ne?: string | number | boolean;
      $in?: Array<string | number>;
      $nin?: Array<string | number>;
      $gt?: string | number;
      $gte?: string | number;
      $lt?: string | number;
      $lte?: string | number;
    };

export type VectorMetadataFilter = Record<string, VectorFilterCondition>;

export interface VectorSearchInput {
  values: number[];
  topK: number;
  namespace?: string | undefined;
  filter?: VectorMetadataFilter | undefined;
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
