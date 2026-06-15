import type { AIProvider } from "@/core/ai/ports";
import type {
  AssetSearchInput,
  AssetSearchRepository,
} from "@/core/assets/ports";
import { createLogger } from "@/core/logging/logger";
import type { MemoryRepository } from "@/core/memory/ports";
import type { JobQueue } from "@/core/queue/ports";
import type { VectorMetadataFilter, VectorStore } from "@/core/vector/ports";
import type { AppBindings } from "@/env";
import type {
  AssetChunkMatch,
  AssetSearchFilters,
} from "@/features/assets/model/types";
import type { ContextRetrievalPolicy } from "@/features/mcp/server/context-profiles";
import { recallGraphStatements } from "@/features/memory/server/graph-recall";
import { buildReinforceGraphAccessMessage } from "@/features/memory/server/reinforcement";
import { applySalienceWeight } from "@/features/memory/server/salience";
import type { EvidenceItem } from "@/features/search/model/evidence";
import type { RecallResult, SearchResult } from "@/features/search/model/types";
import { getAIProviderFromBindings } from "@/platform/ai/workers-ai/get-ai-provider";
import { getAssetSearchRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";
import { getMemoryRepositoryFromBindings } from "@/platform/db/d1/repositories/get-memory-repository";
import { getJobQueueFromBindings } from "@/platform/queue/cloudflare/get-job-queue";
import { getGraphVectorStoreFromBindings } from "@/platform/vector/vectorize/get-graph-vector-store";
import { getVectorStoreFromBindings } from "@/platform/vector/vectorize/get-vector-store";
import {
  applyContextPolicyScore,
  getContextResultScope,
  matchesContextPolicyAsset,
} from "./context-policy";
import {
  annotateEvidenceMatchReasons,
  buildChunkEvidenceItem,
  buildEvidencePacket,
  buildGraphEvidenceItem,
  buildGroupedEvidence,
  buildSummaryEvidenceItem,
  flattenGroupedEvidence,
  toSearchResultItem,
} from "./evidence";
import { FUSION_CHANNEL_WEIGHTS, normalizeChannelScores } from "./fusion";
import {
  DEFAULT_RECALL_LIMIT,
  mergeRecallResults,
  type PerQueryRecall,
  RECALL_PER_QUERY_PAGE_SIZE,
  type RecallMemoriesInput,
} from "./recall";
import { rerankEvidence } from "./rerank";
import { scoreAssetSummaryMatch } from "./summary-scoring";

const SEARCHABLE_AI_VISIBILITY = ["allow"] as const;
const SUMMARY_ONLY_AI_VISIBILITY = ["summary_only"] as const;
const searchLogger = createLogger("search");

const getSearchFilters = (input: AssetSearchFilters): AssetSearchFilters => {
  return {
    type: input.type,
    domain: input.domain,
    sourceKind: input.sourceKind,
    createdAtFrom: input.createdAtFrom,
    createdAtTo: input.createdAtTo,
    sourceHost: input.sourceHost,
    topic: input.topic,
    tag: input.tag,
    collection: input.collection,
  };
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
  // L2 图检索可选依赖：未配置 graph 绑定时优雅退回 null（图通道跳过，不影响主检索）。
  getMemoryRepository?: (
    bindings: AppBindings | undefined
  ) => MemoryRepository | null | Promise<MemoryRepository | null>;
  getGraphVectorStore?: (
    bindings: AppBindings | undefined
  ) => VectorStore | null | Promise<VectorStore | null>;
  // 访问写回闭环：命中图证据后入队强化消息（可选，缺失则跳过强化）。
  getJobQueue?: (
    bindings: AppBindings | undefined
  ) => JobQueue | null | Promise<JobQueue | null>;
}

// graph 依赖工厂在绑定缺失时会抛错；这里包一层 try/catch 让图通道优雅降级为不可用。
const optionalGraphFactory =
  <T>(factory: (bindings: AppBindings | undefined) => T) =>
  (bindings: AppBindings | undefined): T | null => {
    try {
      return factory(bindings);
    } catch {
      return null;
    }
  };

const defaultDependencies: SearchServiceDependencies = {
  getAssetRepository: getAssetSearchRepositoryFromBindings,
  getVectorStore: getVectorStoreFromBindings,
  getAIProvider: getAIProviderFromBindings,
  getMemoryRepository: optionalGraphFactory(getMemoryRepositoryFromBindings),
  getGraphVectorStore: optionalGraphFactory(getGraphVectorStoreFromBindings),
  getJobQueue: optionalGraphFactory(getJobQueueFromBindings),
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

const getLexicalChunkMatches = async (
  repository: AssetSearchRepository,
  input: AssetSearchInput,
  limit: number
): Promise<AssetChunkMatch[]> => {
  if (!repository.searchChunksByText) {
    return [];
  }

  try {
    return await repository.searchChunksByText({
      query: input.query,
      limit,
      aiVisibility: [...SEARCHABLE_AI_VISIBILITY],
      ...getSearchFilters(input),
    });
  } catch {
    // 这里对 FTS 词面检索做兜底，避免边缘 SQL 失败拖垮主链路。
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

const buildLexicalChunkEvidence = (
  lexicalChunkMatches: AssetChunkMatch[],
  contextPolicy?: ContextRetrievalPolicy
): EvidenceItem[] => {
  const total = lexicalChunkMatches.length;

  return lexicalChunkMatches
    .map((chunk, index) =>
      buildChunkEvidenceItem(
        chunk,
        // 已按 bm25 排好序：用降序排名作为通道内分数（normalizeChannelScores 再做归一化）。
        applyContextPolicyScore(
          total > 0 ? (total - index) / total : 0,
          chunk.asset,
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
  lexicalChunkMatches: AssetChunkMatch[],
  contextPolicy?: ContextRetrievalPolicy
): EvidenceItem[] => {
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
    ...normalizeChannelScores(
      buildLexicalChunkEvidence(lexicalChunkMatches, contextPolicy),
      FUSION_CHANNEL_WEIGHTS.lexicalChunk
    ),
    ...normalizeChannelScores(
      orderedSummaryEvidence,
      FUSION_CHANNEL_WEIGHTS.summary
    ),
  ].sort((left, right) => right.score - left.score);
};

const buildSemanticEvidence = (
  query: string,
  vectorMatches: Awaited<ReturnType<VectorStore["search"]>>,
  chunkMatches: Awaited<
    ReturnType<AssetSearchRepository["getChunkMatchesByVectorIds"]>
  >,
  summaryMatches: Awaited<ReturnType<typeof getSummaryMatches>>,
  lexicalChunkMatches: AssetChunkMatch[],
  contextPolicy?: ContextRetrievalPolicy
): EvidenceItem[] => {
  const chunkMatchMap = new Map(
    chunkMatches.map((chunkMatch) => [chunkMatch.vectorId, chunkMatch])
  );
  const orderedChunkEvidence = vectorMatches
    .map((match) => {
      const chunk = chunkMatchMap.get(match.id);

      if (!chunk?.vectorId) {
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
    .filter((item): item is EvidenceItem => item !== null)
    // 这里按 context-policy 调整后的分数排序，作为 chunk 通道内 rank（再交给 RRF），
    // 避免直接沿用原始 cosine 顺序而忽略 boost/suppress 重排。
    .sort((left, right) => right.score - left.score);

  return [
    ...normalizeChannelScores(
      orderedChunkEvidence,
      FUSION_CHANNEL_WEIGHTS.chunk
    ),
    ...buildLexicalEvidence(
      query,
      summaryMatches,
      lexicalChunkMatches,
      contextPolicy
    ),
  ].sort((left, right) => right.score - left.score);
};

// 这里把硬过滤映射为 Vectorize 原生 metadata 过滤（单值字段 + aiVisibility + scopeId）。
// topic/tag 为多值 facet、日期为范围，仍交由下游 D1 join 兜底，不进原生过滤。
const buildSemanticVectorFilter = (
  filters: AssetSearchFilters
): VectorMetadataFilter => {
  const applied = getSearchFilters(filters);
  const filter: VectorMetadataFilter = {
    aiVisibility: { $eq: "allow" },
    // 一期：检索默认只查人记忆 scope（personal）；agent 记忆隔离、不进默认检索，二期参数化。
    scopeId: { $eq: "personal" },
  };

  if (applied.type) {
    filter.type = { $eq: applied.type };
  }
  if (applied.domain) {
    filter.domain = { $eq: applied.domain };
  }
  if (applied.sourceKind) {
    filter.sourceKind = { $eq: applied.sourceKind };
  }
  if (applied.sourceHost) {
    filter.sourceHost = { $eq: applied.sourceHost };
  }
  if (applied.collection) {
    filter.collectionKey = { $eq: applied.collection };
  }

  // M3 时间检索：把 createdAt 范围下推到 Vectorize 原生过滤（ANN topK 之前剪枝），
  // 避免「先取全时段 topK、再 D1 过滤时间」导致时间窗内更相关的结果被截断而漏召回。
  // 值为已规范化的 ISO datetime（字典序=时间序）。
  if (applied.createdAtFrom || applied.createdAtTo) {
    filter.createdAt = {
      ...(applied.createdAtFrom ? { $gte: applied.createdAtFrom } : {}),
      ...(applied.createdAtTo ? { $lte: applied.createdAtTo } : {}),
    };
  }

  return filter;
};

// 这里用 Vectorize 原生 metadata 过滤在 ANN 层一次到位（删除 1/3/6/12 overfetch 阶梯与 240 召回天花板）；
// getChunkMatchesByVectorIds 仅用于 hydration，并对 topic/tag/日期等多值过滤做兜底收敛。
const getSemanticMatches = async (
  vectorStore: VectorStore,
  repository: AssetSearchRepository,
  queryVector: number[],
  topK: number,
  filters: AssetSearchFilters
) => {
  const vectorMatches = await vectorStore.search({
    values: queryVector,
    topK,
    filter: buildSemanticVectorFilter(filters),
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

  return { vectorMatches, chunkMatches };
};

// 图通道按 asset.createdAt 落入时间窗过滤——与 dense/lexical/summary 三通道一致
// （都用 L1 资产的创建时刻，而非 statement.createdAt），避免 recall 带时间窗时
// 图证据无视时间约束漏入窗外记忆。值为已规范化 ISO（字典序=时间序）。
const isAssetWithinCreatedWindow = (
  createdAt: string,
  from: string | undefined,
  to: string | undefined
): boolean => {
  if (from && createdAt < from) {
    return false;
  }
  if (to && createdAt > to) {
    return false;
  }
  return true;
};

// L2 图检索通道：query 向量 → 实体多跳遍历 → 关联事实 → 钻取 L1 资产 → 证据项。
// 任意环节失败/绑定缺失一律降级为空，绝不拖垮主检索。仅纳入 aiVisibility=allow 且合规资产。
const buildGraphEvidence = async (
  queryVector: number[],
  dependencies: SearchServiceDependencies,
  bindings: AppBindings | undefined,
  assetRepository: AssetSearchRepository,
  contextPolicy?: ContextRetrievalPolicy,
  createdAtFrom?: string,
  createdAtTo?: string
): Promise<EvidenceItem[]> => {
  const getMemory = dependencies.getMemoryRepository;
  const getGraph = dependencies.getGraphVectorStore;

  if (!getMemory || !getGraph) {
    return [];
  }

  try {
    const [memoryRepository, graphVectorStore] = await Promise.all([
      getMemory(bindings),
      getGraph(bindings),
    ]);

    if (!memoryRepository || !graphVectorStore) {
      return [];
    }

    const hits = await recallGraphStatements({
      queryVector,
      repository: memoryRepository,
      graphVectorStore,
      // 一期：L2 图通道同样只查 personal scope（与 dense/lexical 一致）。
      scopeId: "personal",
    });

    const hydrate = assetRepository.getAssetSummariesByIds;

    // 仓库未提供批量 hydration（如旧实现/测试 fake）时图通道降级。
    if (!hydrate) {
      return [];
    }

    const assetIds = [
      ...new Set(hits.flatMap((hit) => (hit.assetId ? [hit.assetId] : []))),
    ];

    if (assetIds.length === 0) {
      return [];
    }

    const hydratedAssets = await hydrate.call(assetRepository, assetIds);
    const assetById = new Map(hydratedAssets.map((asset) => [asset.id, asset]));

    const items = hits.flatMap((hit) => {
      if (!hit.assetId) {
        return [];
      }

      const asset = assetById.get(hit.assetId);

      // 仅纳入可检索（aiVisibility=allow）、符合 context profile、且落在时间窗内的资产。
      if (
        !asset ||
        asset.aiVisibility !== "allow" ||
        !matchesContextPolicyAsset(asset, contextPolicy) ||
        !isAssetWithinCreatedWindow(asset.createdAt, createdAtFrom, createdAtTo)
      ) {
        return [];
      }

      // 显著性加权：base 关联分 × recency 衰减 × importance × access 强化，
      // 让久未访问的旧事实下沉、被反复命中的重要事实上浮。
      const salienceWeighted = applySalienceWeight(hit.score, {
        createdAt: hit.statement.createdAt,
        importance: hit.statement.importance,
        accessCount: hit.statement.accessCount,
      });
      const item = buildGraphEvidenceItem(
        hit.statement,
        asset,
        applyContextPolicyScore(salienceWeighted, asset, contextPolicy)
      );

      return [
        annotateEvidenceMatchReasons(item, {
          profileBoosted: Boolean(
            contextPolicy?.boostedDomains.includes(item.asset.domain)
          ),
        }),
      ];
    });

    return normalizeChannelScores(items, FUSION_CHANNEL_WEIGHTS.graph).sort(
      (left, right) => right.score - left.score
    );
  } catch {
    // 图通道是增益项，任何失败都静默降级，不影响主检索结果。
    return [];
  }
};

// 从分页后的证据项里提取被命中的 L2 陈述 id。
// 图证据 id 形如 `statement:<statementId>:<assetId>`（见 buildGraphEvidenceItem），取第 2 段。
const collectGraphStatementIds = (items: EvidenceItem[]): string[] => {
  const ids = new Set<string>();

  for (const item of items) {
    if (item.layer !== "statement") {
      continue;
    }

    const statementId = item.id.split(":")[1];

    if (statementId) {
      ids.add(statementId);
    }
  }

  return [...ids];
};

// 访问写回闭环：把本页命中的图证据 statement 入队强化（bump access_count / last_accessed_at）。
// best-effort——队列缺失、入队失败一律静默；payload 上限 100（与 reinforcement 校验对齐）。
const reinforceGraphAccess = async (
  dependencies: SearchServiceDependencies,
  bindings: AppBindings | undefined,
  items: EvidenceItem[]
): Promise<void> => {
  const getQueue = dependencies.getJobQueue;

  if (!getQueue) {
    return;
  }

  const statementIds = collectGraphStatementIds(items).slice(0, 100);

  if (statementIds.length === 0) {
    return;
  }

  try {
    const jobQueue = await getQueue(bindings);

    if (!jobQueue) {
      return;
    }

    await jobQueue.enqueue(buildReinforceGraphAccessMessage(statementIds));
  } catch {
    // 强化是异步增益项，入队失败不影响本次检索结果。
  }
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
      const [summaryMatches, lexicalChunkMatches] = await Promise.all([
        getSummaryMatches(repository, input, topK, contextPolicy),
        getLexicalChunkMatches(repository, input, topK),
      ]);

      let orderedEvidence: EvidenceItem[];

      if (!queryVector) {
        orderedEvidence = buildLexicalEvidence(
          query,
          summaryMatches,
          lexicalChunkMatches,
          contextPolicy
        );
      } else {
        const { vectorMatches, chunkMatches } = await getSemanticMatches(
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
          lexicalChunkMatches,
          contextPolicy
        );
      }
      // L2 图检索通道：把实体关联召回的事实证据并入融合集（无图数据/绑定时为空）。
      const graphEvidence = queryVector
        ? await buildGraphEvidence(
            queryVector,
            dependencies,
            bindings,
            repository,
            contextPolicy,
            input.createdAtFrom,
            input.createdAtTo
          )
        : [];
      const fusedEvidence =
        graphEvidence.length > 0
          ? [...orderedEvidence, ...graphEvidence].sort(
              (left, right) => right.score - left.score
            )
          : orderedEvidence;
      // 融合后接 cross-encoder 重排 + MMR 多样化；失败优雅退回融合顺序。
      const rerankedEvidence = await rerankEvidence(
        aiProvider,
        query,
        fusedEvidence
      );
      const orderedGroups = buildGroupedEvidence(rerankedEvidence);
      const pageGroups = orderedGroups.slice(offset, offset + pageSize);
      const pageItems = flattenGroupedEvidence(pageGroups);
      // 访问写回闭环：本页真正回给用户的图证据才算「被检索命中」，入队异步强化（不阻塞返回）。
      await reinforceGraphAccess(dependencies, bindings, pageItems);
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

    // recall：吃多个子查询 → 各自走完整检索（纯语义平等，不加权）→ 合并去重整捆返回。
    // 复用 executeSearch 的可见性门控（allow 硬过滤 + summary_only 独立通道）。
    async recallMemories(
      bindings: AppBindings | undefined,
      input: RecallMemoriesInput
    ): Promise<RecallResult> {
      const limit = input.limit ?? DEFAULT_RECALL_LIMIT;
      const order = input.order ?? "relevance";
      const perQuery = await Promise.all(
        input.queries.map(async (query): Promise<PerQueryRecall> => {
          const searchInput: AssetSearchInput = {
            query,
            page: 1,
            pageSize: RECALL_PER_QUERY_PAGE_SIZE,
            ...(input.domain ? { domain: input.domain } : {}),
            // 时间窗（已规范化 ISO）下推检索：向量层原生过滤 + D1 兜底，召回不被 topK 截断。
            ...(input.createdAtFrom
              ? { createdAtFrom: input.createdAtFrom }
              : {}),
            ...(input.createdAtTo ? { createdAtTo: input.createdAtTo } : {}),
          };

          return { query, result: await executeSearch(bindings, searchInput) };
        })
      );
      const memories = mergeRecallResults(perQuery, limit, order);

      return {
        queries: input.queries,
        memories,
        total: memories.length,
      };
    },
  };
};

const searchService = createSearchService();

export const { searchAssets, searchAssetsForContext, recallMemories } =
  searchService;
