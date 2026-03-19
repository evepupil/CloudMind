import type { AIProvider } from "@/core/ai/ports";
import type {
  AssetSearchInput,
  AssetSearchRepository,
} from "@/core/assets/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { AppBindings } from "@/env";
import type { SearchResult } from "@/features/search/model/types";
import { getAIProviderFromBindings } from "@/platform/ai/workers-ai/get-ai-provider";
import { getAssetSearchRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";
import { getVectorStoreFromBindings } from "@/platform/vector/vectorize/get-vector-store";

interface SearchServiceDependencies {
  getAssetRepository: (
    bindings: AppBindings | undefined
  ) => AssetSearchRepository | Promise<AssetSearchRepository>;
  getVectorStore: (
    bindings: AppBindings | undefined
  ) => VectorStore | Promise<VectorStore>;
  getAIProvider: (
    bindings: AppBindings | undefined
  ) => AIProvider | Promise<AIProvider>;
}

const defaultDependencies: SearchServiceDependencies = {
  getAssetRepository: getAssetSearchRepositoryFromBindings,
  getVectorStore: getVectorStoreFromBindings,
  getAIProvider: getAIProviderFromBindings,
};

// 这里集中资产语义搜索用例，便于后续扩展为混合检索或重排。
export const createSearchService = (
  dependencies: SearchServiceDependencies = defaultDependencies
) => {
  return {
    async searchAssets(
      bindings: AppBindings | undefined,
      input: AssetSearchInput
    ): Promise<SearchResult> {
      const query = input.query.trim();

      if (!query) {
        return {
          items: [],
          pagination: {
            page: 1,
            pageSize: input.pageSize ?? 20,
            total: 0,
            totalPages: 0,
          },
        };
      }

      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 20;
      const offset = (page - 1) * pageSize;
      const topK = offset + pageSize;
      const [repository, vectorStore, aiProvider] = await Promise.all([
        dependencies.getAssetRepository(bindings),
        dependencies.getVectorStore(bindings),
        dependencies.getAIProvider(bindings),
      ]);
      const embeddingResult = await aiProvider.createEmbeddings({
        texts: [query],
        purpose: "query",
      });
      const queryVector = embeddingResult.embeddings[0];

      if (!queryVector) {
        return {
          items: [],
          pagination: {
            page,
            pageSize,
            total: 0,
            totalPages: 0,
          },
        };
      }

      const vectorMatches = await vectorStore.search({
        values: queryVector,
        topK,
      });

      if (vectorMatches.length === 0) {
        return {
          items: [],
          pagination: {
            page,
            pageSize,
            total: 0,
            totalPages: 0,
          },
        };
      }

      const chunkMatches = await repository.getChunkMatchesByVectorIds(
        vectorMatches.map((match) => match.id)
      );
      const chunkMatchMap = new Map(
        chunkMatches.map((chunkMatch) => [chunkMatch.vectorId, chunkMatch])
      );
      const orderedMatches = vectorMatches
        .map((match) => {
          const chunk = chunkMatchMap.get(match.id);

          if (!chunk || !chunk.vectorId) {
            return null;
          }

          return {
            score: match.score,
            chunk,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
      const pageItems = orderedMatches.slice(offset, offset + pageSize);

      return {
        items: pageItems,
        pagination: {
          page,
          pageSize,
          total: orderedMatches.length,
          totalPages:
            orderedMatches.length === 0
              ? 0
              : Math.ceil(orderedMatches.length / pageSize),
        },
      };
    },
  };
};

const searchService = createSearchService();

export const { searchAssets } = searchService;
