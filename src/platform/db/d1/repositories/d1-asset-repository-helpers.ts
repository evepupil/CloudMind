import { and, eq, gte, isNotNull, isNull, like, lte, or } from "drizzle-orm";

import type {
  AssetChunkMatch,
  AssetChunkSummary,
  AssetListQuery,
  AssetSearchFilters,
  AssetSummary,
  IngestJobSummary,
} from "@/features/assets/model/types";
import {
  type assetChunks,
  assets,
  type ingestJobs,
} from "@/platform/db/d1/schema";

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
    aiVisibility: record.aiVisibility,
    retrievalPriority: record.retrievalPriority,
    sourceHost: record.sourceHost,
    collectionKey: record.collectionKey,
    capturedAt: record.capturedAt,
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

// 注意：topic / tag 这两个语义切面过滤随 asset_facets 表一起下沉 L2 知识图谱，
// L1 瘦身后不再有承载表，这里暂不生效（保留入参以维持 API 兼容）。
// collection 走 assets.collection_key 这一客观 L1 列，仍然生效。
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

  if (query?.collection) {
    conditions.push(eq(assets.collectionKey, query.collection));
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

  if (filters?.collection) {
    conditions.push(eq(assets.collectionKey, filters.collection));
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
