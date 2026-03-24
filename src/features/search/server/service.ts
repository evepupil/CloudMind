import type { AIProvider } from "@/core/ai/ports";
import type {
  AssetSearchInput,
  AssetSearchRepository,
} from "@/core/assets/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { AppBindings } from "@/env";
import type { ContextRetrievalPolicy } from "@/features/mcp/server/context-profiles";
import type { EvidenceItem } from "@/features/search/model/evidence";
import type { SearchResult } from "@/features/search/model/types";
import { getAIProviderFromBindings } from "@/platform/ai/workers-ai/get-ai-provider";
import { getAssetSearchRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";
import { getVectorStoreFromBindings } from "@/platform/vector/vectorize/get-vector-store";
import { scoreAssetAssertionMatch } from "./assertion-scoring";
import {
  applyContextPolicyScore,
  getContextResultScope,
  matchesContextPolicyAsset,
} from "./context-policy";
import {
  buildAssertionEvidenceItem,
  buildChunkEvidenceItem,
  buildSummaryEvidenceItem,
  toSearchResultItem,
} from "./evidence";
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

  try {
    return await repository.searchAssetSummaries({
      query,
      limit,
      aiVisibility: [...SUMMARY_ONLY_AI_VISIBILITY],
    });
  } catch {
    // 这里对 lexical summary 检索做兜底，避免边缘 SQL 失败拖垮主链路。
    return [];
  }
};

const getAssertionMatches = async (
  repository: AssetSearchRepository,
  query: string,
  limit: number,
  contextPolicy?: ContextRetrievalPolicy
) => {
  if (!repository.searchAssetAssertions) {
    return [];
  }

  if (contextPolicy && !contextPolicy.includeSummaryOnly) {
    return [];
  }

  try {
    return await repository.searchAssetAssertions({
      query,
      limit,
      aiVisibility: [
        ...SUMMARY_ONLY_AI_VISIBILITY,
        ...SEARCHABLE_AI_VISIBILITY,
      ],
    });
  } catch {
    // 这里对 lexical assertion 检索做兜底，避免长 query 时报错。
    return [];
  }
};

const withOptionalResultScope = <T extends SearchResult>(
  result: T,
  scope: SearchResult["resultScope"]
): T => {
  if (!scope) {
    return result;
  }

  return {
    ...result,
    resultScope: scope,
  };
};

const buildLexicalEvidence = (
  query: string,
  repositoryMatches: Awaited<ReturnType<typeof getSummaryMatches>>,
  assertionMatches: Awaited<ReturnType<typeof getAssertionMatches>>,
  contextPolicy?: ContextRetrievalPolicy
): EvidenceItem[] => {
  const orderedAssertionEvidence = assertionMatches
    .map((match) =>
      buildAssertionEvidenceItem(
        match,
        applyContextPolicyScore(
          scoreAssetAssertionMatch(query, match),
          match.asset,
          contextPolicy
        )
      )
    )
    .filter((item) => matchesContextPolicyAsset(item.asset, contextPolicy))
    .sort((left, right) => right.score - left.score);
  const orderedSummaryEvidence = repositoryMatches
    .map((match) =>
      buildSummaryEvidenceItem(
        match,
        applyContextPolicyScore(
          scoreAssetSummaryMatch(query, match),
          match.asset,
          contextPolicy
        )
      )
    )
    .filter((item) => matchesContextPolicyAsset(item.asset, contextPolicy))
    .sort((left, right) => right.score - left.score);

  return [...orderedAssertionEvidence, ...orderedSummaryEvidence].sort(
    (left, right) => right.score - left.score
  );
};

const buildSemanticEvidence = (
  query: string,
  vectorMatches: Awaited<ReturnType<VectorStore["search"]>>,
  chunkMatches: Awaited<
    ReturnType<AssetSearchRepository["getChunkMatchesByVectorIds"]>
  >,
  summaryMatches: Awaited<ReturnType<typeof getSummaryMatches>>,
  assertionMatches: Awaited<ReturnType<typeof getAssertionMatches>>,
  contextPolicy?: ContextRetrievalPolicy
): EvidenceItem[] => {
  const chunkMatchMap = new Map(
    chunkMatches.map((chunkMatch) => [chunkMatch.vectorId, chunkMatch])
  );
  const orderedChunkEvidence = vectorMatches
    .map((match) => {
      const chunk = chunkMatchMap.get(match.id);

      if (!chunk || !chunk.vectorId) {
        return null;
      }

      return buildChunkEvidenceItem(
        chunk,
        applyContextPolicyScore(match.score, chunk.asset, contextPolicy)
      );
    })
    .filter((item) =>
      item ? matchesContextPolicyAsset(item.asset, contextPolicy) : false
    )
    .filter((item): item is EvidenceItem => item !== null);

  return [
    ...orderedChunkEvidence,
    ...buildLexicalEvidence(
      query,
      summaryMatches,
      assertionMatches,
      contextPolicy
    ),
  ].sort((left, right) => right.score - left.score);
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
    const assertionMatches = await getAssertionMatches(
      repository,
      query,
      topK,
      contextPolicy
    );

    let orderedEvidence: EvidenceItem[];

    if (!queryVector) {
      orderedEvidence = buildLexicalEvidence(
        query,
        summaryMatches,
        assertionMatches,
        contextPolicy
      );
    } else {
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

      orderedEvidence = buildSemanticEvidence(
        query,
        vectorMatches,
        chunkMatches,
        summaryMatches,
        assertionMatches,
        contextPolicy
      );
    }
    const pageItems = orderedEvidence.slice(offset, offset + pageSize);
    const resultScope = getContextResultScope(
      pageItems.map((item) => item.asset),
      contextPolicy
    );

    return withOptionalResultScope(
      {
        items: pageItems.map(toSearchResultItem),
        pagination: {
          page,
          pageSize,
          total: orderedEvidence.length,
          totalPages:
            orderedEvidence.length === 0
              ? 0
              : Math.ceil(orderedEvidence.length / pageSize),
        },
      },
      resultScope
    );
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
