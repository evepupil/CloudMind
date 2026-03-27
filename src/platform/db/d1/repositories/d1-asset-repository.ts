import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  like,
  or,
  sql,
} from "drizzle-orm";

import { AssetNotFoundError } from "@/core/assets/errors";
import type {
  AssetRepository,
  AssetSearchInput,
  ChunkMatchQuery,
  CompleteAssetProcessingInput,
  CreateAssetAssertionInput,
  CreateAssetChunkInput,
  CreateAssetFacetInput,
  CreateFileAssetInput,
  CreateTextAssetInput,
  CreateUrlAssetInput,
  SearchAssetAssertionInput,
  SearchAssetSummaryInput,
  UpdateAssetIndexingInput,
  UpdateAssetMetadataInput,
} from "@/core/assets/ports";
import type {
  AssetAssertionMatch,
  AssetAssertionSummary,
  AssetChunkMatch,
  AssetChunkSummary,
  AssetDetail,
  AssetFacetSummary,
  AssetFacetTermQuery,
  AssetFacetTermResult,
  AssetListQuery,
  AssetListResult,
  AssetSourceKind,
  AssetSummary,
  AssetSummaryMatch,
  AssetTermMatchItem,
  AssetType,
  FacetTermRef,
  IngestJobSummary,
} from "@/features/assets/model/types";
import { createDb } from "@/platform/db/d1/client";
import {
  assetAssertions,
  assetChunks,
  assetFacets,
  assetSources,
  assets,
  ingestJobs,
} from "@/platform/db/d1/schema";
import {
  ASSERTION_SEARCH_TERM_BUDGETS,
  expandSearchTerms,
  MAX_ASSERTION_SEARCH_TERMS,
  MAX_SUMMARY_SEARCH_TERMS,
  SUMMARY_SEARCH_TERM_BUDGETS,
} from "./search-term-expansion";

const normalizeUniqueStrings = (values: string[] | undefined): string[] => {
  if (!values?.length) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
};

const createInitialTextDescriptorJson = (
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

const createInitialTextFacetRows = (
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

const mapAssetSummary = (record: typeof assets.$inferSelect): AssetSummary => {
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

const mapJobSummary = (
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

const mapChunkSummary = (
  record: typeof assetChunks.$inferSelect
): AssetChunkSummary => {
  return {
    id: record.id,
    chunkIndex: record.chunkIndex,
    textPreview: record.textPreview,
    contentText: record.contentText,
    vectorId: record.vectorId,
  };
};

const mapChunkMatch = (record: {
  chunk: typeof assetChunks.$inferSelect;
  asset: typeof assets.$inferSelect;
}): AssetChunkMatch => {
  return {
    ...mapChunkSummary(record.chunk),
    asset: mapAssetSummary(record.asset),
  };
};

const mapFacetSummary = (
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

const mapAssertionSummary = (
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

const mapAssertionMatch = (record: {
  assertion: typeof assetAssertions.$inferSelect;
  asset: typeof assets.$inferSelect;
}): AssetAssertionMatch => {
  return {
    ...mapAssertionSummary(record.assertion),
    asset: mapAssetSummary(record.asset),
  };
};

const buildAssetListWhereClause = (query?: AssetListQuery) => {
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

const splitIntoBatches = <T>(items: T[], batchSize: number): T[][] => {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }

  return batches;
};

const buildLikeCondition = (
  column:
    | typeof assets.title
    | typeof assets.summary
    | typeof assets.sourceUrl
    | typeof assets.sourceHost,
  term: string
) => {
  return like(column, `%${term}%`);
};

const buildFacetExistsCondition = (
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

// 这里实现面向 D1 的资产仓储；后续如切数据库，只替换这一层。
export class D1AssetRepository implements AssetRepository {
  private readonly db: ReturnType<typeof createDb>;

  public constructor(database: D1Database) {
    this.db = createDb(database);
  }

  public async listAssets(query?: AssetListQuery): Promise<AssetListResult> {
    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const whereClause = buildAssetListWhereClause(query);
    const records = await this.db
      .select()
      .from(assets)
      .where(whereClause)
      .orderBy(desc(assets.createdAt))
      .limit(pageSize)
      .offset(offset);

    const [totalResult] = await this.db
      .select({ value: count() })
      .from(assets)
      .where(whereClause);

    const total = totalResult?.value ?? 0;

    return {
      items: records.map(mapAssetSummary),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  public async searchAssets(input: AssetSearchInput): Promise<AssetListResult> {
    return this.listAssets({
      query: input.query,
      page: input.page,
      pageSize: input.pageSize,
    });
  }

  public async getAssetsByFacetTerms(
    input: AssetFacetTermQuery
  ): Promise<AssetFacetTermResult> {
    if (input.terms.length === 0) {
      return {
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      };
    }

    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    // 构建 OR 条件：(facet_key = ? AND facet_value = ?) OR ...
    const facetConditions = input.terms.map((term) =>
      and(
        eq(assetFacets.facetKey, term.facetKey),
        eq(assetFacets.facetValue, term.facetValue)
      )
    );
    const facetOr = or(...facetConditions);

    if (!facetOr) {
      return {
        items: [],
        pagination: { page, pageSize, total: 0, totalPages: 0 },
      };
    }

    // 先查匹配的 asset_id + facet 信息（不过分页，用于构建 matchedTerms）
    const allFacetRows = await this.db
      .select({
        assetId: assetFacets.assetId,
        facetKey: assetFacets.facetKey,
        facetValue: assetFacets.facetValue,
        assetCreatedAt: assets.createdAt,
      })
      .from(assetFacets)
      .innerJoin(assets, eq(assetFacets.assetId, assets.id))
      .where(
        and(
          isNull(assets.deletedAt),
          facetOr,
          input.aiVisibility?.length
            ? inArray(assets.aiVisibility, input.aiVisibility)
            : undefined
        )
      );

    // 按 asset 分组收集匹配的 terms
    const assetTermMap = new Map<string, FacetTermRef[]>();
    const assetCreatedAtMap = new Map<string, string>();
    const seenFacetKeys = new Set<string>();

    for (const row of allFacetRows) {
      const facetDedupeKey = `${row.assetId}:${row.facetKey}:${row.facetValue}`;

      if (seenFacetKeys.has(facetDedupeKey)) {
        continue;
      }

      seenFacetKeys.add(facetDedupeKey);

      const existing = assetTermMap.get(row.assetId) ?? [];
      existing.push({
        facetKey: row.facetKey as FacetTermRef["facetKey"],
        facetValue: row.facetValue,
      });
      assetTermMap.set(row.assetId, existing);
      assetCreatedAtMap.set(row.assetId, row.assetCreatedAt);
    }

    const rankedAssets = sortFacetMatchedAssets(
      Array.from(assetTermMap.entries()).map(([assetId, matchedTerms]) => ({
        assetId,
        createdAt: assetCreatedAtMap.get(assetId) ?? "",
        matchedTerms: [...matchedTerms].sort((left, right) => {
          const leftOrder = input.terms.findIndex(
            (term) =>
              term.facetKey === left.facetKey &&
              term.facetValue === left.facetValue
          );
          const rightOrder = input.terms.findIndex(
            (term) =>
              term.facetKey === right.facetKey &&
              term.facetValue === right.facetValue
          );

          if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
          }

          return getFacetTermOrderKey(left).localeCompare(
            getFacetTermOrderKey(right)
          );
        }),
      })),
      input.terms
    );
    const matchingAssetIds = rankedAssets.map((item) => item.assetId);

    if (matchingAssetIds.length === 0) {
      return {
        items: [],
        pagination: { page, pageSize, total: 0, totalPages: 0 },
      };
    }

    // 分页查询 assets（按 created_at DESC）
    const total = matchingAssetIds.length;
    const pagedIds = matchingAssetIds.slice(offset, offset + pageSize);

    const assetRecords: Array<typeof assets.$inferSelect> = [];

    for (const batch of splitIntoBatches(pagedIds, 80)) {
      const records = await this.db
        .select()
        .from(assets)
        .where(
          and(isNull(assets.deletedAt), inArray(assets.id, batch))
        );

      assetRecords.push(...records);
    }

    // 保持 pagedIds 顺序
    const assetMap = new Map(
      assetRecords.map((record) => [record.id, record])
    );
    const items: AssetTermMatchItem[] = pagedIds
      .filter((id) => assetMap.has(id))
      .map((id) => ({
        asset: mapAssetSummary(assetMap.get(id)!),
        matchedTerms: assetTermMap.get(id) ?? [],
      }));

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  public async getChunkMatchesByVectorIds(
    vectorIds: string[],
    query?: ChunkMatchQuery
  ): Promise<AssetChunkMatch[]> {
    if (vectorIds.length === 0) {
      return [];
    }

    const records = [];

    // 这里按批读取 vectorId，避免 inArray 参数过多时触发 D1 绑定上限。
    for (const batch of splitIntoBatches(vectorIds, 80)) {
      const conditions = [
        inArray(assetChunks.vectorId, batch),
        isNull(assets.deletedAt),
      ];

      if (query?.aiVisibility?.length) {
        conditions.push(inArray(assets.aiVisibility, query.aiVisibility));
      }

      const batchRecords = await this.db
        .select({
          chunk: assetChunks,
          asset: assets,
        })
        .from(assetChunks)
        .innerJoin(assets, eq(assetChunks.assetId, assets.id))
        .where(and(...conditions));

      records.push(...batchRecords);
    }

    return records.map(mapChunkMatch);
  }

  public async searchAssetSummaries(
    input: SearchAssetSummaryInput
  ): Promise<AssetSummaryMatch[]> {
    const query = input.query.trim();

    if (!query || input.limit <= 0 || input.aiVisibility.length === 0) {
      return [];
    }

    for (const budget of SUMMARY_SEARCH_TERM_BUDGETS) {
      const searchTerms = expandSearchTerms(
        query,
        Math.min(budget, MAX_SUMMARY_SEARCH_TERMS)
      );
      const searchCondition = or(
        ...searchTerms.flatMap((term) => [
          like(assets.title, `%${term}%`),
          like(assets.summary, `%${term}%`),
          like(assets.sourceUrl, `%${term}%`),
        ])
      );

      if (!searchCondition) {
        continue;
      }

      try {
        const records = await this.db
          .select()
          .from(assets)
          .where(
            and(
              isNull(assets.deletedAt),
              eq(assets.status, "ready"),
              isNotNull(assets.summary),
              inArray(assets.aiVisibility, input.aiVisibility),
              searchCondition
            )
          )
          .orderBy(desc(assets.retrievalPriority), desc(assets.updatedAt))
          .limit(input.limit);

        return records
          .filter(
            (
              record
            ): record is typeof assets.$inferSelect & { summary: string } =>
              typeof record.summary === "string" &&
              record.summary.trim().length > 0
          )
          .map((record) => ({
            asset: mapAssetSummary(record),
            summary: record.summary,
          }));
      } catch (error) {
        if (budget === SUMMARY_SEARCH_TERM_BUDGETS.at(-1)) {
          throw error;
        }
      }
    }

    return [];
  }

  public async searchAssetAssertions(
    input: SearchAssetAssertionInput
  ): Promise<AssetAssertionMatch[]> {
    const query = input.query.trim();

    if (!query || input.limit <= 0 || input.aiVisibility.length === 0) {
      return [];
    }

    for (const budget of ASSERTION_SEARCH_TERM_BUDGETS) {
      const searchTerms = expandSearchTerms(
        query,
        Math.min(budget, MAX_ASSERTION_SEARCH_TERMS)
      );
      const searchCondition = or(
        ...searchTerms.map((term) => like(assetAssertions.text, `%${term}%`))
      );

      if (!searchCondition) {
        continue;
      }

      try {
        const records = await this.db
          .select({
            assertion: assetAssertions,
            asset: assets,
          })
          .from(assetAssertions)
          .innerJoin(assets, eq(assetAssertions.assetId, assets.id))
          .where(
            and(
              isNull(assets.deletedAt),
              eq(assets.status, "ready"),
              inArray(assets.aiVisibility, input.aiVisibility),
              searchCondition
            )
          )
          .orderBy(
            desc(assetAssertions.confidence),
            desc(assets.retrievalPriority),
            desc(assetAssertions.updatedAt)
          )
          .limit(input.limit);

        return records.map(mapAssertionMatch);
      } catch (error) {
        if (budget === ASSERTION_SEARCH_TERM_BUDGETS.at(-1)) {
          throw error;
        }
      }
    }

    return [];
  }

  public async listAssetIdsMissingChunkContent(limit = 50): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({
        assetId: assetChunks.assetId,
      })
      .from(assetChunks)
      .innerJoin(assets, eq(assetChunks.assetId, assets.id))
      .where(
        and(
          eq(assetChunks.contentText, ""),
          inArray(assets.type, ["note", "pdf", "chat"]),
          inArray(assets.status, ["ready", "failed"]),
          isNull(assets.deletedAt)
        )
      )
      .orderBy(asc(assetChunks.assetId))
      .limit(limit);

    return rows.map((row) => row.assetId);
  }

  public async getAssetById(id: string): Promise<AssetDetail> {
    const [assetRecord] = await this.db
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), isNull(assets.deletedAt)))
      .limit(1);

    if (!assetRecord) {
      throw new AssetNotFoundError(id);
    }

    const [sourceRecord] = await this.db
      .select()
      .from(assetSources)
      .where(eq(assetSources.assetId, id))
      .orderBy(desc(assetSources.createdAt))
      .limit(1);

    const jobRecords = await this.db
      .select()
      .from(ingestJobs)
      .where(eq(ingestJobs.assetId, id))
      .orderBy(desc(ingestJobs.createdAt));
    const chunkRecords = await this.db
      .select()
      .from(assetChunks)
      .where(eq(assetChunks.assetId, id))
      .orderBy(asc(assetChunks.chunkIndex));
    const facetRecords = await this.db
      .select()
      .from(assetFacets)
      .where(eq(assetFacets.assetId, id))
      .orderBy(asc(assetFacets.sortOrder), asc(assetFacets.facetLabel));
    const assertionRecords = await this.db
      .select()
      .from(assetAssertions)
      .where(eq(assetAssertions.assetId, id))
      .orderBy(asc(assetAssertions.assertionIndex));

    return {
      ...mapAssetSummary(assetRecord),
      contentText: assetRecord.contentText,
      rawR2Key: assetRecord.rawR2Key,
      contentR2Key: assetRecord.contentR2Key,
      mimeType: assetRecord.mimeType,
      language: assetRecord.language,
      errorMessage: assetRecord.errorMessage,
      processedAt: assetRecord.processedAt,
      failedAt: assetRecord.failedAt,
      source: sourceRecord
        ? {
            kind: sourceRecord.kind as AssetSourceKind,
            sourceUrl: sourceRecord.sourceUrl,
            metadataJson: sourceRecord.metadataJson,
            createdAt: sourceRecord.createdAt,
          }
        : null,
      jobs: jobRecords.map(mapJobSummary),
      chunks: chunkRecords.map(mapChunkSummary),
      facets: facetRecords.map(mapFacetSummary),
      assertions: assertionRecords.map(mapAssertionSummary),
    };
  }

  public async createTextAsset(
    input: CreateTextAssetInput
  ): Promise<AssetDetail> {
    const now = new Date().toISOString();
    const assetId = crypto.randomUUID();
    const sourceId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const title = input.title?.trim() || "Untitled Note";
    const sourceKind = input.sourceKind ?? "manual";
    const summary = input.enrichment?.summary ?? null;
    const domain = input.enrichment?.domain ?? "general";
    const documentClass = input.enrichment?.documentClass ?? "general_note";
    const collectionKey =
      input.enrichment?.descriptor?.collectionKey?.trim() || null;
    const descriptorJson = createInitialTextDescriptorJson(input);

    await this.db.insert(assets).values({
      id: assetId,
      type: "note" satisfies AssetType,
      title,
      summary,
      sourceUrl: null,
      sourceKind,
      status: "pending",
      domain,
      sensitivity: "internal",
      aiVisibility: "allow",
      retrievalPriority: 0,
      documentClass,
      sourceHost: null,
      collectionKey,
      capturedAt: now,
      descriptorJson,
      contentText: input.content,
      rawR2Key: null,
      contentR2Key: null,
      mimeType: "text/plain",
      language: null,
      errorMessage: null,
      processedAt: null,
      failedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const facetRows = createInitialTextFacetRows(
      assetId,
      now,
      input.enrichment?.facets
    );

    if (facetRows.length > 0) {
      await this.db.insert(assetFacets).values(facetRows);
    }

    await this.db.insert(assetSources).values({
      id: sourceId,
      assetId,
      kind: sourceKind,
      sourceUrl: null,
      metadataJson: JSON.stringify({
        titleProvided: Boolean(input.title?.trim()),
      }),
      createdAt: now,
    });

    await this.db.insert(ingestJobs).values({
      id: jobId,
      assetId,
      jobType: "extract_content",
      status: "queued",
      attempt: 0,
      errorMessage: null,
      payloadJson: JSON.stringify({
        assetType: "note",
      }),
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return this.getAssetById(assetId);
  }

  public async createUrlAsset(
    input: CreateUrlAssetInput
  ): Promise<AssetDetail> {
    const now = new Date().toISOString();
    const assetId = crypto.randomUUID();
    const sourceId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const title = input.title?.trim() || input.url;
    const sourceKind = input.sourceKind ?? "manual";

    await this.db.insert(assets).values({
      id: assetId,
      type: "url" satisfies AssetType,
      title,
      summary: null,
      sourceUrl: input.url,
      sourceKind,
      status: "pending",
      domain: "general",
      sensitivity: "internal",
      aiVisibility: "allow",
      retrievalPriority: 0,
      documentClass: "reference_doc",
      sourceHost: null,
      collectionKey: null,
      capturedAt: now,
      descriptorJson: null,
      contentText: null,
      rawR2Key: null,
      contentR2Key: null,
      mimeType: "text/html",
      language: null,
      errorMessage: null,
      processedAt: null,
      failedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await this.db.insert(assetSources).values({
      id: sourceId,
      assetId,
      kind: sourceKind,
      sourceUrl: input.url,
      metadataJson: JSON.stringify({
        titleProvided: Boolean(input.title?.trim()),
      }),
      createdAt: now,
    });

    await this.db.insert(ingestJobs).values({
      id: jobId,
      assetId,
      jobType: "fetch_source",
      status: "queued",
      attempt: 0,
      errorMessage: null,
      payloadJson: JSON.stringify({
        assetType: "url",
        sourceUrl: input.url,
      }),
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return this.getAssetById(assetId);
  }

  public async createFileAsset(
    input: CreateFileAssetInput
  ): Promise<AssetDetail> {
    const now = new Date().toISOString();
    const sourceId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const title = input.title?.trim() || input.fileName;

    await this.db.insert(assets).values({
      id: input.id,
      type: "pdf" satisfies AssetType,
      title,
      summary: null,
      sourceUrl: null,
      sourceKind: "upload",
      status: "pending",
      domain: "general",
      sensitivity: "internal",
      aiVisibility: "allow",
      retrievalPriority: 0,
      documentClass: "reference_doc",
      sourceHost: null,
      collectionKey: null,
      capturedAt: now,
      descriptorJson: null,
      contentText: null,
      rawR2Key: input.rawR2Key,
      contentR2Key: null,
      mimeType: input.mimeType,
      language: null,
      errorMessage: null,
      processedAt: null,
      failedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await this.db.insert(assetSources).values({
      id: sourceId,
      assetId: input.id,
      kind: "upload",
      sourceUrl: null,
      metadataJson: JSON.stringify({
        fileName: input.fileName,
        fileSize: input.fileSize,
      }),
      createdAt: now,
    });

    await this.db.insert(ingestJobs).values({
      id: jobId,
      assetId: input.id,
      jobType: "extract_content",
      status: "queued",
      attempt: 0,
      errorMessage: null,
      payloadJson: JSON.stringify({
        assetType: "pdf",
        rawR2Key: input.rawR2Key,
        fileName: input.fileName,
        fileSize: input.fileSize,
      }),
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return this.getAssetById(input.id);
  }

  public async markAssetProcessing(id: string): Promise<void> {
    await this.db
      .update(assets)
      .set({
        status: "processing",
        errorMessage: null,
        failedAt: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(assets.id, id));
  }

  public async completeAssetProcessing(
    id: string,
    input: CompleteAssetProcessingInput
  ): Promise<void> {
    const now = new Date().toISOString();
    const updatePayload: Partial<typeof assets.$inferInsert> = {
      status: "ready",
      summary: input.summary,
      errorMessage: null,
      failedAt: null,
      processedAt: now,
      updatedAt: now,
    };

    if (input.contentText !== undefined) {
      updatePayload.contentText = input.contentText;
    }

    if (input.rawR2Key !== undefined) {
      updatePayload.rawR2Key = input.rawR2Key;
    }

    if (input.contentR2Key !== undefined) {
      updatePayload.contentR2Key = input.contentR2Key;
    }

    await this.db.update(assets).set(updatePayload).where(eq(assets.id, id));
  }

  public async replaceAssetChunks(
    assetId: string,
    chunks: CreateAssetChunkInput[]
  ): Promise<void> {
    await this.db.delete(assetChunks).where(eq(assetChunks.assetId, assetId));

    if (chunks.length === 0) {
      return;
    }

    const now = new Date().toISOString();
    const rows = chunks.map((chunk) => ({
      id: crypto.randomUUID(),
      assetId,
      chunkIndex: chunk.chunkIndex,
      textPreview: chunk.textPreview,
      contentText: chunk.contentText,
      vectorId: chunk.vectorId ?? null,
      createdAt: now,
      updatedAt: now,
    }));

    // 这里按批写入，避开 Cloudflare D1 单条查询最多 100 个绑定参数的限制。
    for (const batch of splitIntoBatches(rows, 12)) {
      await this.db.insert(assetChunks).values(batch);
    }
  }

  public async replaceAssetFacets(
    assetId: string,
    facets: CreateAssetFacetInput[]
  ): Promise<void> {
    await this.db.delete(assetFacets).where(eq(assetFacets.assetId, assetId));

    if (facets.length === 0) {
      return;
    }

    const now = new Date().toISOString();
    const rows = facets.map((facet, index) => ({
      id: crypto.randomUUID(),
      assetId,
      facetKey: facet.facetKey,
      facetValue: facet.facetValue,
      facetLabel: facet.facetLabel,
      sortOrder: facet.sortOrder ?? index,
      createdAt: now,
    }));

    // ??????? 7 ??????? 12 ???????? D1 ? 100 ?????
    for (const batch of splitIntoBatches(rows, 12)) {
      await this.db.insert(assetFacets).values(batch);
    }
  }

  public async replaceAssetAssertions(
    assetId: string,
    assertions: CreateAssetAssertionInput[]
  ): Promise<void> {
    await this.db
      .delete(assetAssertions)
      .where(eq(assetAssertions.assetId, assetId));

    if (assertions.length === 0) {
      return;
    }

    const now = new Date().toISOString();
    const rows = assertions.map((assertion) => ({
      id: crypto.randomUUID(),
      assetId,
      assertionIndex: assertion.assertionIndex,
      kind: assertion.kind,
      text: assertion.text,
      sourceChunkIndex: assertion.sourceChunkIndex ?? null,
      sourceSpanJson: assertion.sourceSpanJson ?? null,
      confidence: assertion.confidence ?? null,
      createdAt: now,
      updatedAt: now,
    }));

    for (const batch of splitIntoBatches(rows, 12)) {
      await this.db.insert(assetAssertions).values(batch);
    }
  }

  public async updateAssetIndexing(
    id: string,
    input: UpdateAssetIndexingInput
  ): Promise<void> {
    const updatePayload: Partial<typeof assets.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (input.sourceKind !== undefined) {
      updatePayload.sourceKind = input.sourceKind;
    }

    if (input.domain !== undefined) {
      updatePayload.domain = input.domain;
    }

    if (input.sensitivity !== undefined) {
      updatePayload.sensitivity = input.sensitivity;
    }

    if (input.aiVisibility !== undefined) {
      updatePayload.aiVisibility = input.aiVisibility;
    }

    if (input.retrievalPriority !== undefined) {
      updatePayload.retrievalPriority = input.retrievalPriority;
    }

    if (input.documentClass !== undefined) {
      updatePayload.documentClass = input.documentClass;
    }

    if (input.sourceHost !== undefined) {
      updatePayload.sourceHost = input.sourceHost;
    }

    if (input.collectionKey !== undefined) {
      updatePayload.collectionKey = input.collectionKey;
    }

    if (input.capturedAt !== undefined) {
      updatePayload.capturedAt = input.capturedAt;
    }

    if (input.descriptorJson !== undefined) {
      updatePayload.descriptorJson = input.descriptorJson;
    }

    await this.db.update(assets).set(updatePayload).where(eq(assets.id, id));
  }

  public async failAssetProcessing(id: string, message: string): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(assets)
      .set({
        status: "failed",
        errorMessage: message,
        failedAt: now,
        updatedAt: now,
      })
      .where(eq(assets.id, id));
  }

  public async markIngestJobRunning(jobId: string): Promise<void> {
    await this.db
      .update(ingestJobs)
      .set({
        status: "running",
        errorMessage: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(ingestJobs.id, jobId));
  }

  public async completeIngestJob(jobId: string): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(ingestJobs)
      .set({
        status: "succeeded",
        errorMessage: null,
        finishedAt: now,
        updatedAt: now,
      })
      .where(eq(ingestJobs.id, jobId));
  }

  public async failIngestJob(jobId: string, message: string): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(ingestJobs)
      .set({
        status: "failed",
        errorMessage: message,
        finishedAt: now,
        updatedAt: now,
      })
      .where(eq(ingestJobs.id, jobId));
  }

  public async updateAssetMetadata(
    id: string,
    input: UpdateAssetMetadataInput
  ): Promise<AssetDetail> {
    await this.getAssetById(id);

    const now = new Date().toISOString();
    const updatePayload: Partial<typeof assets.$inferInsert> = {
      updatedAt: now,
    };

    if (input.title !== undefined) {
      updatePayload.title = input.title;
    }

    if (input.summary !== undefined) {
      updatePayload.summary = input.summary;
    }

    if (input.sourceUrl !== undefined) {
      updatePayload.sourceUrl = input.sourceUrl;
    }

    await this.db.update(assets).set(updatePayload).where(eq(assets.id, id));

    if (input.sourceUrl !== undefined) {
      await this.db
        .update(assetSources)
        .set({
          sourceUrl: input.sourceUrl,
        })
        .where(eq(assetSources.assetId, id));
    }

    return this.getAssetById(id);
  }

  public async softDeleteAsset(id: string): Promise<void> {
    await this.getAssetById(id);

    const now = new Date().toISOString();

    await this.db
      .update(assets)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(assets.id, id));
  }

  public async restoreAsset(id: string): Promise<AssetDetail> {
    const now = new Date().toISOString();

    await this.db
      .update(assets)
      .set({
        deletedAt: null,
        updatedAt: now,
      })
      .where(eq(assets.id, id));

    return this.getAssetById(id);
  }
}
