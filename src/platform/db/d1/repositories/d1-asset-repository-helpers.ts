import {
  and,
  eq,
  gte,
  isNotNull,
  isNull,
  like,
  lte,
  or,
  sql,
} from "drizzle-orm";

import type {
  CreateAssetFacetInput,
  CreateTextAssetInput,
} from "@/core/assets/ports";
import type {
  AssetAssertionMatch,
  AssetAssertionSummary,
  AssetChunkMatch,
  AssetChunkSummary,
  AssetFacetSummary,
  AssetListQuery,
  AssetSearchFilters,
  AssetSummary,
  FacetTermRef,
  IngestJobSummary,
} from "@/features/assets/model/types";
import {
  type assetAssertions,
  type assetChunks,
  assetFacets,
  assets,
  type ingestJobs,
} from "@/platform/db/d1/schema";

export const normalizeUniqueStrings = (
  values: string[] | undefined
): string[] => {
  if (!values?.length) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
};

export const createInitialTextDescriptorJson = (
  input: CreateTextAssetInput
): string | null => {
  const topics = normalizeUniqueStrings(input.enrichment?.descriptor?.topics);
  const tags = normalizeUniqueStrings(input.enrichment?.descriptor?.tags);
  const signals = normalizeUniqueStrings(input.enrichment?.descriptor?.signals);
  const collectionKey = input.enrichment?.descriptor?.collectionKey?.trim();

  if (
    topics.length === 0 &&
    tags.length === 0 &&
    signals.length === 0 &&
    !collectionKey
  ) {
    return null;
  }

  return JSON.stringify({
    topics,
    tags,
    signals,
    collectionKey: collectionKey || null,
  });
};

export const createInitialTextFacetRows = (
  assetId: string,
  now: string,
  facets: CreateAssetFacetInput[] | undefined
): Array<typeof assetFacets.$inferInsert> => {
  if (!facets?.length) {
    return [];
  }

  return facets.map((facet, index) => ({
    id: crypto.randomUUID(),
    assetId,
    facetKey: facet.facetKey,
    facetValue: facet.facetValue,
    facetLabel: facet.facetLabel,
    sortOrder: facet.sortOrder ?? index,
    createdAt: now,
  }));
};

export const mapAssetSummary = (
  record: typeof assets.$inferSelect
): AssetSummary => {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    summary: record.summary,
    sourceUrl: record.sourceUrl,
    sourceKind: record.sourceKind,
    status: record.status,
    domain: record.domain,
    sensitivity: record.sensitivity,
    aiVisibility: record.aiVisibility,
    retrievalPriority: record.retrievalPriority,
    documentClass: record.documentClass,
    sourceHost: record.sourceHost,
    collectionKey: record.collectionKey,
    capturedAt: record.capturedAt,
    descriptorJson: record.descriptorJson,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

export const mapJobSummary = (
  record: typeof ingestJobs.$inferSelect
): IngestJobSummary => {
  return {
    id: record.id,
    jobType: record.jobType,
    status: record.status,
    attempt: record.attempt,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

export const mapChunkSummary = (
  record: typeof assetChunks.$inferSelect
): AssetChunkSummary => {
  return {
    id: record.id,
    chunkIndex: record.chunkIndex,
    textPreview: record.textPreview,
    contentText: record.contentText,
    vectorId: record.vectorId,
    contentHash: record.contentHash,
    embeddingModel: record.embeddingModel,
    embeddingDim: record.embeddingDim,
  };
};

export const mapChunkMatch = (record: {
  chunk: typeof assetChunks.$inferSelect;
  asset: typeof assets.$inferSelect;
}): AssetChunkMatch => {
  return {
    ...mapChunkSummary(record.chunk),
    asset: mapAssetSummary(record.asset),
  };
};

export const mapFacetSummary = (
  record: typeof assetFacets.$inferSelect
): AssetFacetSummary => {
  return {
    id: record.id,
    facetKey: record.facetKey,
    facetValue: record.facetValue,
    facetLabel: record.facetLabel,
    sortOrder: record.sortOrder,
  };
};

export const mapAssertionSummary = (
  record: typeof assetAssertions.$inferSelect
): AssetAssertionSummary => {
  return {
    id: record.id,
    assertionIndex: record.assertionIndex,
    kind: record.kind,
    text: record.text,
    sourceChunkIndex: record.sourceChunkIndex,
    sourceSpanJson: record.sourceSpanJson,
    confidence: record.confidence,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

export const mapAssertionMatch = (record: {
  assertion: typeof assetAssertions.$inferSelect;
  asset: typeof assets.$inferSelect;
}): AssetAssertionMatch => {
  return {
    ...mapAssertionSummary(record.assertion),
    asset: mapAssetSummary(record.asset),
  };
};

export const buildAssetListWhereClause = (query?: AssetListQuery) => {
  const conditions = [];

  if (query?.deleted === "only") {
    conditions.push(isNotNull(assets.deletedAt));
  } else if (query?.deleted !== "include") {
    conditions.push(isNull(assets.deletedAt));
  }

  if (query?.status) {
    conditions.push(eq(assets.status, query.status));
  }

  if (query?.type) {
    conditions.push(eq(assets.type, query.type));
  }

  if (query?.domain) {
    conditions.push(eq(assets.domain, query.domain));
  }

  if (query?.documentClass) {
    conditions.push(eq(assets.documentClass, query.documentClass));
  }

  if (query?.sourceKind) {
    conditions.push(eq(assets.sourceKind, query.sourceKind));
  }

  if (query?.aiVisibility) {
    conditions.push(eq(assets.aiVisibility, query.aiVisibility));
  }

  if (query?.createdAtFrom) {
    conditions.push(gte(assets.createdAt, query.createdAtFrom));
  }

  if (query?.createdAtTo) {
    conditions.push(lte(assets.createdAt, query.createdAtTo));
  }

  if (query?.sourceHost) {
    conditions.push(buildLikeCondition(assets.sourceHost, query.sourceHost));
  }

  const topicCondition = buildFacetExistsCondition("topic", query?.topic);

  if (topicCondition) {
    conditions.push(topicCondition);
  }

  const tagCondition = buildFacetExistsCondition("tag", query?.tag);

  if (tagCondition) {
    conditions.push(tagCondition);
  }

  const collectionCondition = buildFacetExistsCondition(
    "collection",
    query?.collection
  );

  if (collectionCondition) {
    conditions.push(collectionCondition);
  }

  if (query?.query) {
    const searchCondition = or(
      buildLikeCondition(assets.title, query.query),
      buildLikeCondition(assets.summary, query.query),
      buildLikeCondition(assets.sourceUrl, query.query)
    );

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
};

export const buildAssetSearchFilterConditions = (
  filters?: AssetSearchFilters
) => {
  const conditions = [isNull(assets.deletedAt), eq(assets.status, "ready")];

  if (filters?.type) {
    conditions.push(eq(assets.type, filters.type));
  }

  if (filters?.domain) {
    conditions.push(eq(assets.domain, filters.domain));
  }

  if (filters?.documentClass) {
    conditions.push(eq(assets.documentClass, filters.documentClass));
  }

  if (filters?.sourceKind) {
    conditions.push(eq(assets.sourceKind, filters.sourceKind));
  }

  if (filters?.createdAtFrom) {
    conditions.push(gte(assets.createdAt, filters.createdAtFrom));
  }

  if (filters?.createdAtTo) {
    conditions.push(lte(assets.createdAt, filters.createdAtTo));
  }

  if (filters?.sourceHost) {
    conditions.push(buildLikeCondition(assets.sourceHost, filters.sourceHost));
  }

  const topicCondition = buildFacetExistsCondition("topic", filters?.topic);

  if (topicCondition) {
    conditions.push(topicCondition);
  }

  const tagCondition = buildFacetExistsCondition("tag", filters?.tag);

  if (tagCondition) {
    conditions.push(tagCondition);
  }

  const collectionCondition = buildFacetExistsCondition(
    "collection",
    filters?.collection
  );

  if (collectionCondition) {
    conditions.push(collectionCondition);
  }

  return conditions;
};

export const splitIntoBatches = <T>(items: T[], batchSize: number): T[][] => {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }

  return batches;
};

export const buildLikeCondition = (
  column:
    | typeof assets.title
    | typeof assets.summary
    | typeof assets.sourceUrl
    | typeof assets.sourceHost,
  term: string
) => {
  return like(column, `%${term}%`);
};

export const buildFacetExistsCondition = (
  facetKey: "topic" | "tag" | "collection",
  facetValue: string | undefined
) => {
  if (!facetValue) {
    return undefined;
  }

  return sql`exists (
    select 1
    from ${assetFacets}
    where ${assetFacets.assetId} = ${assets.id}
      and ${assetFacets.facetKey} = ${facetKey}
      and ${assetFacets.facetValue} = ${facetValue}
  )`;
};

interface RankedFacetMatchedAsset {
  assetId: string;
  createdAt: string;
  matchedTerms: FacetTermRef[];
}

const getFacetTermOrderKey = (term: FacetTermRef) =>
  `${term.facetKey}:${term.facetValue}`;

export { getFacetTermOrderKey };

export const sortFacetMatchedAssets = (
  items: RankedFacetMatchedAsset[],
  rankedTerms: FacetTermRef[]
): RankedFacetMatchedAsset[] => {
  const termOrder = new Map(
    rankedTerms.map((term, index) => [getFacetTermOrderKey(term), index])
  );

  const getBestRank = (matchedTerms: FacetTermRef[]) => {
    return matchedTerms.reduce((best, term) => {
      const rank = termOrder.get(getFacetTermOrderKey(term));

      if (rank === undefined) {
        return best;
      }

      return Math.min(best, rank);
    }, Number.MAX_SAFE_INTEGER);
  };

  return [...items].sort((left, right) => {
    const rankDiff =
      getBestRank(left.matchedTerms) - getBestRank(right.matchedTerms);

    if (rankDiff !== 0) {
      return rankDiff;
    }

    const termCountDiff = right.matchedTerms.length - left.matchedTerms.length;

    if (termCountDiff !== 0) {
      return termCountDiff;
    }

    const createdAtDiff =
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

    if (createdAtDiff !== 0) {
      return createdAtDiff;
    }

    return left.assetId.localeCompare(right.assetId);
  });
};
