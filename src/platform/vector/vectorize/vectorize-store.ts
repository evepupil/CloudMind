import type {
  VectorRecord,
  VectorSearchInput,
  VectorSearchMatch,
  VectorStore,
} from "@/core/vector/ports";

// Vectorize 在 returnMetadata:"all" 下 topK 上限为 50（超过会报 VECTOR_QUERY_ERROR 40025）。
// 适配器统一用 returnMetadata:"all"（业务需要 textPreview / 元数据词项），故在此钳制 topK。
const MAX_TOP_K_WITH_FULL_METADATA = 50;

const parseMetadataJson = (
  metadataJson: string | undefined
): Record<string, VectorizeVectorMetadata> | undefined => {
  if (!metadataJson) {
    return undefined;
  }

  const parsed = JSON.parse(metadataJson) as Record<
    string,
    VectorizeVectorMetadata
  >;

  return parsed;
};

// 这里封装 Cloudflare Vectorize，避免业务层直接依赖具体索引 API。
export class VectorizeStore implements VectorStore {
  private readonly index: Vectorize;

  public constructor(index: Vectorize) {
    this.index = index;
  }

  public async upsert(records: VectorRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    await this.index.upsert(
      records.map((record) => {
        const metadata = parseMetadataJson(record.metadataJson);
        const baseVector = {
          id: record.id,
          values: record.values,
        };

        const vectorWithNamespace = record.namespace
          ? {
              ...baseVector,
              namespace: record.namespace,
            }
          : baseVector;

        return metadata
          ? {
              ...vectorWithNamespace,
              metadata,
            }
          : vectorWithNamespace;
      })
    );
  }

  public async search(input: VectorSearchInput): Promise<VectorSearchMatch[]> {
    const options: VectorizeQueryOptions = {
      topK: Math.min(input.topK, MAX_TOP_K_WITH_FULL_METADATA),
      returnMetadata: "all",
    };

    if (input.namespace) {
      options.namespace = input.namespace;
    }

    if (input.filter) {
      // 这里把统一过滤条件下推给 Vectorize 原生 metadata 过滤（topK 之前生效）。
      options.filter = input.filter as unknown as VectorizeVectorMetadataFilter;
    }

    const result = await this.index.query(input.values, options);

    return result.matches.map((match) => ({
      id: match.id,
      score: match.score,
      metadataJson: match.metadata ? JSON.stringify(match.metadata) : undefined,
    }));
  }

  public async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.index.deleteByIds(ids);
  }
}
