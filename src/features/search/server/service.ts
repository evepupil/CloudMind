import type { AIProvider } from "@/core/ai/ports";
import type {
  AssetSearchInput,
  AssetSearchRepository,
} from "@/core/assets/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { AppBindings } from "@/env";
import type { ContextRetrievalPolicy } from "@/features/mcp/server/context-profiles";
import type { SearchResult } from "@/features/search/model/types";
import { getAIProviderFromBindings } from "@/platform/ai/workers-ai/get-ai-provider";
import { getAssetSearchRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";
import { getVectorStoreFromBindings } from "@/platform/vector/vectorize/get-vector-store";

import {
  applyContextPolicyScore,
  matchesContextPolicyAsset,
} from "./context-policy";
import { scoreAssetSummaryMatch } from "./summary-scoring";

const SEARCHABLE_AI_VISIBILITY = ["allow"] as const;
const SUMMARY_ONLY_AI_VISIBILITY = ["summary_only"] as const;

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

const getSummaryMatches = async (
  repository: AssetSearchRepository,
  query: string,
  limit: number,
  contextPolicy?: ContextRetrievalPolicy
) => {
  if (contextPolicy && !contextPolicy.includeSummaryOnly) {
    return [];
  }

  return repository.searchAssetSummaries({
    query,
    limit,
    aiVisibility: [...SUMMARY_ONLY_AI_VISIBILITY],
  });
};

// 这里集中资产语义搜索用例，便于后续扩展为混合检索或重排。
export const createSearchService = (
  dependencies: SearchServiceDependencies = defaultDependencies
) => {
  const executeSearch = async (
    bindings: AppBindings | undefined,
    input: AssetSearchInput,
    contextPolicy?: ContextRetrievalPolicy
  ): Promise<SearchResult> => {
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
    const overfetchMultiplier = Math.max(
      contextPolicy?.overfetchMultiplier ?? 1,
      1
    );
    const topK = (offset + pageSize) * overfetchMultiplier;
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
    const summaryMatches = await getSummaryMatches(
      repository,
      query,
      topK,
      contextPolicy
    );

    if (!queryVector) {
      const orderedSummaryMatches = summaryMatches
        .map((match) => ({
          kind: "summary" as const,
          score: applyContextPolicyScore(
            scoreAssetSummaryMatch(query, match),
            match.asset,
            contextPolicy
          ),
          asset: match.asset,
          summary: match.summary,
        }))
        .filter((match) =>
          matchesContextPolicyAsset(match.asset, contextPolicy)
        )
        .sort((left, right) => right.score - left.score);
      const pageItems = orderedSummaryMatches.slice(offset, offset + pageSize);

      return {
        items: pageItems,
        pagination: {
          page,
          pageSize,
          total: orderedSummaryMatches.length,
          totalPages:
            orderedSummaryMatches.length === 0
              ? 0
              : Math.ceil(orderedSummaryMatches.length / pageSize),
        },
      };
    }

    const vectorMatches = await vectorStore.search({
      values: queryVector,
      topK,
    });
    const chunkMatches =
      vectorMatches.length > 0
        ? await repository.getChunkMatchesByVectorIds(
            vectorMatches.map((match) => match.id),
            {
              aiVisibility: [...SEARCHABLE_AI_VISIBILITY],
            }
          )
        : [];
    const chunkMatchMap = new Map(
      chunkMatches.map((chunkMatch) => [chunkMatch.vectorId, chunkMatch])
    );
    const orderedChunkMatches = vectorMatches
      .map((match) => {
        const chunk = chunkMatchMap.get(match.id);

        if (!chunk || !chunk.vectorId) {
          return null;
        }

        return {
          kind: "chunk" as const,
          score: applyContextPolicyScore(
            match.score,
            chunk.asset,
            contextPolicy
          ),
          chunk,
        };
      })
      .filter((item) =>
        item ? matchesContextPolicyAsset(item.chunk.asset, contextPolicy) : false
      )
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const orderedSummaryMatches = summaryMatches
      .map((match) => ({
        kind: "summary" as const,
        score: applyContextPolicyScore(
          scoreAssetSummaryMatch(query, match),
          match.asset,
          contextPolicy
        ),
        asset: match.asset,
        summary: match.summary,
      }))
      .filter((match) => matchesContextPolicyAsset(match.asset, contextPolicy))
      .sort((left, right) => right.score - left.score);
    const orderedMatches = [...orderedChunkMatches, ...orderedSummaryMatches]
      .sort((left, right) => right.score - left.score);
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
  };

  return {
    async searchAssets(
      bindings: AppBindings | undefined,
      input: AssetSearchInput
    ): Promise<SearchResult> {
      return executeSearch(bindings, input);
    },

    async searchAssetsForContext(
      bindings: AppBindings | undefined,
      input: AssetSearchInput,
      contextPolicy: ContextRetrievalPolicy
    ): Promise<SearchResult> {
      return executeSearch(bindings, input, contextPolicy);
    },
  };
};

const searchService = createSearchService();

export const { searchAssets, searchAssetsForContext } = searchService;
