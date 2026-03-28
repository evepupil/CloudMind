import type { AIProvider } from "@/core/ai/ports";
import type {
  AssetSearchInput,
  AssetSearchRepository,
} from "@/core/assets/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { AppBindings } from "@/env";
import type { AssetSearchFilters } from "@/features/assets/model/types";
import type { ContextRetrievalPolicy } from "@/features/mcp/server/context-profiles";
import type { EvidenceItem } from "@/features/search/model/evidence";
import type { SearchResult } from "@/features/search/model/types";
import { getAIProviderFromBindings } from "@/platform/ai/workers-ai/get-ai-provider";
import { getAssetSearchRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";
import { createLogger } from "@/platform/observability/logger";
import { getVectorStoreFromBindings } from "@/platform/vector/vectorize/get-vector-store";
import { scoreAssetAssertionMatch } from "./assertion-scoring";
import {
  applyContextPolicyScore,
  getContextResultScope,
  matchesContextPolicyAsset,
} from "./context-policy";
import {
  annotateEvidenceMatchReasons,
  buildAssertionEvidenceItem,
  buildChunkEvidenceItem,
  buildEvidencePacket,
  buildGroupedEvidence,
  buildSummaryEvidenceItem,
  buildTermEvidenceItem,
  flattenGroupedEvidence,
  toSearchResultItem,
} from "./evidence";
import { scoreAssetSummaryMatch } from "./summary-scoring";
import type { SearchAssetsByTermsResult } from "./term-asset-service";
import { searchAssetsByTerms } from "./term-asset-service";
import { scoreAssetTermMatch } from "./term-scoring";

const SEARCHABLE_AI_VISIBILITY = ["allow"] as const;
const SUMMARY_ONLY_AI_VISIBILITY = ["summary_only"] as const;
const FILTERED_VECTOR_FETCH_MULTIPLIERS = [1, 3, 6, 12] as const;
const MAX_FILTERED_VECTOR_TOP_K = 240;
const searchLogger = createLogger("search");

const getSearchFilters = (input: AssetSearchFilters): AssetSearchFilters => {
  return {
    type: input.type,
    domain: input.domain,
    documentClass: input.documentClass,
    sourceKind: input.sourceKind,
    createdAtFrom: input.createdAtFrom,
    createdAtTo: input.createdAtTo,
    sourceHost: input.sourceHost,
    topic: input.topic,
    tag: input.tag,
    collection: input.collection,
  };
};

const hasHardSearchFilters = (filters: AssetSearchFilters): boolean => {
  return Object.values(getSearchFilters(filters)).some(
    (value) => value !== undefined
  );
};

const getAppliedFilterKeys = (filters: AssetSearchFilters): string[] => {
  return Object.entries(getSearchFilters(filters))
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key)
    .sort();
};

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
  searchAssetsByTerms: (
    bindings: AppBindings | undefined,
    input: {
      query: string;
      filters?: AssetSearchFilters | undefined;
      topK?: number | undefined;
      page?: number | undefined;
      pageSize?: number | undefined;
    }
  ) => Promise<SearchAssetsByTermsResult>;
}

const defaultDependencies: SearchServiceDependencies = {
  getAssetRepository: getAssetSearchRepositoryFromBindings,
  getVectorStore: getVectorStoreFromBindings,
  getAIProvider: getAIProviderFromBindings,
  searchAssetsByTerms,
};

const getSummaryMatches = async (
  repository: AssetSearchRepository,
  input: AssetSearchInput,
  limit: number,
  contextPolicy?: ContextRetrievalPolicy
) => {
  if (contextPolicy && !contextPolicy.includeSummaryOnly) {
    return [];
  }

  try {
    return await repository.searchAssetSummaries({
      query: input.query,
      limit,
      aiVisibility: [...SUMMARY_ONLY_AI_VISIBILITY],
      ...getSearchFilters(input),
    });
  } catch {
    // 这里对 lexical summary 检索做兜底，避免边缘 SQL 失败拖垮主链路。
    return [];
  }
};

const getAssertionMatches = async (
  repository: AssetSearchRepository,
  input: AssetSearchInput,
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
      query: input.query,
      limit,
      aiVisibility: [
        ...SUMMARY_ONLY_AI_VISIBILITY,
        ...SEARCHABLE_AI_VISIBILITY,
      ],
      ...getSearchFilters(input),
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

const buildTermEvidence = (
  termMatches: SearchAssetsByTermsResult,
  contextPolicy?: ContextRetrievalPolicy
): EvidenceItem[] => {
  return termMatches.items
    .filter((item) =>
      contextPolicy?.includeSummaryOnly === false
        ? item.asset.aiVisibility === "allow"
        : true
    )
    .map((item) =>
      buildTermEvidenceItem(
        item,
        applyContextPolicyScore(
          scoreAssetTermMatch(termMatches.terms, item),
          item.asset,
          contextPolicy
        )
      )
    )
    .map((item) =>
      annotateEvidenceMatchReasons(item, {
        profileBoosted: Boolean(
          contextPolicy?.boostedDomains.includes(item.asset.domain)
        ),
      })
    )
    .filter((item) => matchesContextPolicyAsset(item.asset, contextPolicy))
    .sort((left, right) => right.score - left.score);
};

const buildLexicalEvidence = (
  query: string,
  repositoryMatches: Awaited<ReturnType<typeof getSummaryMatches>>,
  assertionMatches: Awaited<ReturnType<typeof getAssertionMatches>>,
  termMatches: SearchAssetsByTermsResult,
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
    .map((item) =>
      annotateEvidenceMatchReasons(item, {
        profileBoosted: Boolean(
          contextPolicy?.boostedDomains.includes(item.asset.domain)
        ),
      })
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
    .map((item) =>
      annotateEvidenceMatchReasons(item, {
        profileBoosted: Boolean(
          contextPolicy?.boostedDomains.includes(item.asset.domain)
        ),
      })
    )
    .filter((item) => matchesContextPolicyAsset(item.asset, contextPolicy))
    .sort((left, right) => right.score - left.score);

  return [
    ...orderedAssertionEvidence,
    ...buildTermEvidence(termMatches, contextPolicy),
    ...orderedSummaryEvidence,
  ].sort((left, right) => right.score - left.score);
};

const buildSemanticEvidence = (
  query: string,
  vectorMatches: Awaited<ReturnType<VectorStore["search"]>>,
  chunkMatches: Awaited<
    ReturnType<AssetSearchRepository["getChunkMatchesByVectorIds"]>
  >,
  summaryMatches: Awaited<ReturnType<typeof getSummaryMatches>>,
  assertionMatches: Awaited<ReturnType<typeof getAssertionMatches>>,
  termMatches: SearchAssetsByTermsResult,
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
    .map((item) =>
      item
        ? annotateEvidenceMatchReasons(item, {
            profileBoosted: Boolean(
              contextPolicy?.boostedDomains.includes(item.asset.domain)
            ),
          })
        : null
    )
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
      termMatches,
      contextPolicy
    ),
  ].sort((left, right) => right.score - left.score);
};

const getFilteredSemanticMatches = async (
  vectorStore: VectorStore,
  repository: AssetSearchRepository,
  queryVector: number[],
  topK: number,
  filters: AssetSearchFilters
) => {
  const shouldOverfetch = hasHardSearchFilters(filters);
  let lastVectorMatches: Awaited<ReturnType<VectorStore["search"]>> = [];
  let lastChunkMatches: Awaited<
    ReturnType<AssetSearchRepository["getChunkMatchesByVectorIds"]>
  > = [];

  for (const multiplier of FILTERED_VECTOR_FETCH_MULTIPLIERS) {
    const requestedTopK = shouldOverfetch
      ? Math.min(topK * multiplier, MAX_FILTERED_VECTOR_TOP_K)
      : topK;

    if (
      lastVectorMatches.length > 0 &&
      requestedTopK <= lastVectorMatches.length
    ) {
      continue;
    }

    const vectorMatches = await vectorStore.search({
      values: queryVector,
      topK: requestedTopK,
    });
    const chunkMatches =
      vectorMatches.length > 0
        ? await repository.getChunkMatchesByVectorIds(
            vectorMatches.map((match) => match.id),
            {
              aiVisibility: [...SEARCHABLE_AI_VISIBILITY],
              ...getSearchFilters(filters),
            }
          )
        : [];

    lastVectorMatches = vectorMatches;
    lastChunkMatches = chunkMatches;

    if (!shouldOverfetch) {
      break;
    }

    if (chunkMatches.length >= topK || vectorMatches.length < requestedTopK) {
      break;
    }
  }

  return {
    vectorMatches: lastVectorMatches,
    chunkMatches: lastChunkMatches,
  };
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
    const startedAt = Date.now();
    const query = input.query.trim();
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    const appliedFilterKeys = getAppliedFilterKeys(input);

    try {
      if (!query) {
        const emptyResult = {
          items: [],
          evidence: buildEvidencePacket([]),
          groupedEvidence: [],
          pagination: {
            page: 1,
            pageSize,
            total: 0,
            totalPages: 0,
          },
        };

        searchLogger.info("search_completed", {
          durationMs: Date.now() - startedAt,
          queryLength: 0,
          page: 1,
          pageSize,
          appliedFilterKeys,
          resultCount: 0,
          groupedEvidenceCount: 0,
          totalGroups: 0,
          resultScope: null,
          contextProfile: contextPolicy?.profile ?? null,
          allowFallback: contextPolicy?.allowFallback ?? false,
        });

        return emptyResult;
      }

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
      const [summaryMatches, assertionMatches, termMatches] = await Promise.all(
        [
          getSummaryMatches(repository, input, topK, contextPolicy),
          getAssertionMatches(repository, input, topK, contextPolicy),
          dependencies.searchAssetsByTerms(bindings, {
            query,
            filters: getSearchFilters(input),
            topK,
            page: 1,
            pageSize: topK,
          }),
        ]
      );

      let orderedEvidence: EvidenceItem[];

      if (!queryVector) {
        orderedEvidence = buildLexicalEvidence(
          query,
          summaryMatches,
          assertionMatches,
          termMatches,
          contextPolicy
        );
      } else {
        const { vectorMatches, chunkMatches } =
          await getFilteredSemanticMatches(
            vectorStore,
            repository,
            queryVector,
            topK,
            input
          );

        orderedEvidence = buildSemanticEvidence(
          query,
          vectorMatches,
          chunkMatches,
          summaryMatches,
          assertionMatches,
          termMatches,
          contextPolicy
        );
      }
      const orderedGroups = buildGroupedEvidence(orderedEvidence);
      const pageGroups = orderedGroups.slice(offset, offset + pageSize);
      const pageItems = flattenGroupedEvidence(pageGroups);
      const resultScope = getContextResultScope(
        pageGroups.map((group) => group.asset),
        contextPolicy
      );

      const result = withOptionalResultScope(
        {
          items: pageItems.map(toSearchResultItem),
          evidence: buildEvidencePacket(pageItems),
          groupedEvidence: pageGroups,
          pagination: {
            page,
            pageSize,
            total: orderedGroups.length,
            totalPages:
              orderedGroups.length === 0
                ? 0
                : Math.ceil(orderedGroups.length / pageSize),
          },
        },
        resultScope
      );

      searchLogger.info("search_completed", {
        durationMs: Date.now() - startedAt,
        queryLength: query.length,
        page,
        pageSize,
        topK,
        appliedFilterKeys,
        hasQueryVector: Boolean(queryVector),
        resultCount: result.items.length,
        groupedEvidenceCount: result.groupedEvidence.length,
        totalGroups: result.pagination.total,
        resultScope: resultScope ?? null,
        contextProfile: contextPolicy?.profile ?? null,
        allowFallback: contextPolicy?.allowFallback ?? false,
      });

      return result;
    } catch (error) {
      searchLogger.error(
        "search_failed",
        {
          durationMs: Date.now() - startedAt,
          queryLength: query.length,
          page,
          pageSize,
          appliedFilterKeys,
          contextProfile: contextPolicy?.profile ?? null,
          allowFallback: contextPolicy?.allowFallback ?? false,
        },
        { error }
      );

      throw error;
    }
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
