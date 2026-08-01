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

import {
  AssetNotFoundError,
  AssetRawSnapshotConflictError,
} from "@/core/assets/errors";
import type {
  AssetRepository,
  AssetSearchInput,
  ChunkMatchQuery,
  CompleteAssetProcessingInput,
  CreateAssetChunkInput,
  CreateFileAssetInput,
  CreateTextAssetInput,
  CreateUrlAssetInput,
  MemoryVersionQuery,
  RecordContextSummary,
  SearchAssetSummaryInput,
  UpdateAssetIndexingInput,
  UpdateAssetMetadataInput,
} from "@/core/assets/ports";
import { PERSONAL_SCOPE } from "@/core/memory/scope";
import {
  GLOBAL_CONTEXT_KEY,
  LIBRARY_RECORD_KIND,
  normalizeContextKey,
} from "@/core/records/classification";
import type {
  AssetChunkMatch,
  AssetDetail,
  AssetListQuery,
  AssetListResult,
  AssetSourceKind,
  AssetSummary,
  AssetSummaryMatch,
  AssetType,
} from "@/features/assets/model/types";
import { createDb } from "@/platform/db/d1/client";
import {
  assetChunks,
  assetSources,
  assets,
  ingestJobs,
} from "@/platform/db/d1/schema";
import {
  buildAssetListWhereClause,
  buildAssetSearchFilterConditions,
  mapAssetSummary,
  mapChunkMatch,
  mapChunkSummary,
  mapJobSummary,
  splitIntoBatches,
} from "./d1-asset-repository-helpers";
import { buildFtsMatchQuery } from "./fts-query";
import {
  expandSearchTerms,
  MAX_SUMMARY_SEARCH_TERMS,
  SUMMARY_SEARCH_TERM_BUDGETS,
} from "./search-term-expansion";

// 这里实现面向 D1 的资产仓储；后续如切数据库，只替换这一层。
export class D1AssetRepository implements AssetRepository {
  private readonly database: D1Database;
  private readonly db: ReturnType<typeof createDb>;

  public constructor(database: D1Database) {
    this.database = database;
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

  public async listMemoryVersions(
    query: MemoryVersionQuery
  ): Promise<AssetSummary[]> {
    const records = await this.db
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.recordKind, "memory"),
          eq(assets.scopeId, query.scopeId),
          eq(assets.contextKey, query.contextKey),
          or(
            eq(assets.memoryRootId, query.memoryRootId),
            eq(assets.id, query.memoryRootId)
          )
        )
      )
      .orderBy(desc(assets.memoryVersion), desc(assets.createdAt));

    return records.map(mapAssetSummary);
  }

  public async listRecordContexts(
    query?: AssetListQuery
  ): Promise<RecordContextSummary[]> {
    const records = await this.db
      .select({
        contextKey: assets.contextKey,
        activeCount: sql<number>`sum(case when ${assets.deletedAt} is null then 1 else 0 end)`,
        forgottenCount: sql<number>`sum(case when ${assets.deletedAt} is not null then 1 else 0 end)`,
        personalCount: sql<number>`sum(case when ${assets.deletedAt} is null and ${assets.scopeId} = 'personal' then 1 else 0 end)`,
        agentCount: sql<number>`sum(case when ${assets.deletedAt} is null and ${assets.scopeId} = 'agent' then 1 else 0 end)`,
        latestUpdatedAt: sql<string>`max(${assets.updatedAt})`,
      })
      .from(assets)
      .where(buildAssetListWhereClause(query))
      .groupBy(assets.contextKey)
      .orderBy(desc(sql`max(${assets.updatedAt})`));

    return records.map((record) => ({
      contextKey: record.contextKey,
      activeCount: Number(record.activeCount),
      forgottenCount: Number(record.forgottenCount),
      personalCount: Number(record.personalCount),
      agentCount: Number(record.agentCount),
      latestUpdatedAt: record.latestUpdatedAt,
    }));
  }

  public async searchAssets(input: AssetSearchInput): Promise<AssetListResult> {
    return this.listAssets(input);
  }

  public async getAssetSummariesByIds(ids: string[]): Promise<AssetSummary[]> {
    if (ids.length === 0) {
      return [];
    }

    const records = await this.db
      .select()
      .from(assets)
      // 排除软删和被取代资产，避免图检索把历史版本作为当前证据带回。
      .where(
        and(
          inArray(assets.id, ids),
          isNull(assets.deletedAt),
          isNull(assets.supersededAt)
        )
      );

    return records.map(mapAssetSummary);
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
        ...buildAssetSearchFilterConditions(query),
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

  public async searchChunksByText(
    input: SearchAssetSummaryInput
  ): Promise<AssetChunkMatch[]> {
    const match = buildFtsMatchQuery(input.query);

    if (!match || input.limit <= 0 || input.aiVisibility.length === 0) {
      return [];
    }

    // Step 1：FTS5 trigram MATCH，按 bm25 升序（越小越相关）取有序 chunk id。
    const ftsRows = await this.db.all<{ chunk_id: string }>(
      sql`SELECT chunk_id FROM asset_chunks_fts WHERE asset_chunks_fts MATCH ${match} ORDER BY bm25(asset_chunks_fts) LIMIT ${input.limit}`
    );
    const orderedIds = ftsRows.map((row) => row.chunk_id);

    if (orderedIds.length === 0) {
      return [];
    }

    // Step 2：按 id 取 chunk+asset 并套用可见性/硬过滤，再按 bm25 顺序还原。
    const records = await this.db
      .select({ chunk: assetChunks, asset: assets })
      .from(assetChunks)
      .innerJoin(assets, eq(assetChunks.assetId, assets.id))
      .where(
        and(
          inArray(assetChunks.id, orderedIds),
          ...buildAssetSearchFilterConditions(input),
          inArray(assets.aiVisibility, input.aiVisibility)
        )
      );
    const byId = new Map(
      records.map((record) => [record.chunk.id, mapChunkMatch(record)])
    );

    return orderedIds
      .map((id) => byId.get(id))
      .filter((value): value is AssetChunkMatch => Boolean(value));
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
              ...buildAssetSearchFilterConditions(input),
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
          isNull(assets.deletedAt),
          isNull(assets.supersededAt)
        )
      )
      .orderBy(asc(assetChunks.assetId))
      .limit(limit);

    return rows.map((row) => row.assetId);
  }

  public async getAssetById(
    id: string,
    options?: { includeDeleted?: boolean | undefined }
  ): Promise<AssetDetail> {
    const [assetRecord] = await this.db
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.id, id),
          options?.includeDeleted ? undefined : isNull(assets.deletedAt)
        )
      )
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
    const recordKind = input.recordKind ?? LIBRARY_RECORD_KIND;

    await this.db.insert(assets).values({
      id: assetId,
      type: "note" satisfies AssetType,
      title,
      summary: null,
      sourceUrl: null,
      sourceKind,
      status: "pending",
      domain: "general",
      // 显式 pin 时用 pin 值作初值，使 enqueue 后的快照即正确；classify 步骤会保留它。
      aiVisibility: input.aiVisibility ?? "allow",
      retrievalPriority: 0,
      recordKind,
      // 写入归属 scope：默认 personal（人记忆）；remember_agent 传 agent。
      scopeId: input.scopeId ?? PERSONAL_SCOPE,
      contextKey: normalizeContextKey(input.contextKey),
      memoryRootId:
        recordKind === "memory" ? (input.memoryRootId ?? assetId) : null,
      memoryVersion:
        recordKind === "memory" ? (input.memoryVersion ?? 1) : null,
      previousVersionId:
        recordKind === "memory" ? (input.previousVersionId ?? null) : null,
      supersededById: null,
      supersededAt: null,
      sourceHost: null,
      collectionKey: null,
      capturedAt: now,
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
      aiVisibility: "allow",
      retrievalPriority: 0,
      recordKind: LIBRARY_RECORD_KIND,
      scopeId: input.scopeId ?? PERSONAL_SCOPE,
      contextKey: normalizeContextKey(input.contextKey),
      sourceHost: null,
      collectionKey: null,
      capturedAt: now,
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
      aiVisibility: "allow",
      retrievalPriority: 0,
      recordKind: LIBRARY_RECORD_KIND,
      scopeId: PERSONAL_SCOPE,
      contextKey: normalizeContextKey(input.contextKey),
      sourceHost: null,
      collectionKey: null,
      capturedAt: now,
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

  public async attachAssetRawSnapshot(
    id: string,
    rawR2Key: string
  ): Promise<void> {
    const updated = await this.db
      .update(assets)
      .set({
        rawR2Key,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(assets.id, id), isNull(assets.rawR2Key)))
      .returning({ id: assets.id });

    if (updated.length === 1) {
      return;
    }

    const [existing] = await this.db
      .select({ rawR2Key: assets.rawR2Key })
      .from(assets)
      .where(eq(assets.id, id))
      .limit(1);

    if (!existing) {
      throw new AssetNotFoundError(id);
    }

    if (existing.rawR2Key !== rawR2Key) {
      throw new AssetRawSnapshotConflictError(id);
    }
  }

  public async markAssetProcessing(id: string): Promise<boolean> {
    const claimed = await this.db
      .update(assets)
      .set({
        status: "processing",
        errorMessage: null,
        failedAt: null,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(assets.id, id),
          inArray(assets.status, ["pending", "ready", "failed"])
        )
      )
      .returning({ id: assets.id });

    return claimed.length === 1;
  }

  public async completeAssetProcessing(
    id: string,
    input: CompleteAssetProcessingInput
  ): Promise<void> {
    const now = new Date().toISOString();
    const [version] = await this.db
      .select({
        recordKind: assets.recordKind,
        scopeId: assets.scopeId,
        contextKey: assets.contextKey,
        previousVersionId: assets.previousVersionId,
      })
      .from(assets)
      .where(eq(assets.id, id))
      .limit(1);

    if (!version) {
      throw new AssetNotFoundError(id);
    }

    if (version.recordKind === "memory" && version.previousVersionId) {
      const results = await this.database.batch([
        this.database
          .prepare(
            `UPDATE assets
             SET superseded_by_id = ?, superseded_at = ?, updated_at = ?
             WHERE id = ? AND record_kind = 'memory' AND scope_id = ?
               AND context_key = ? AND deleted_at IS NULL
               AND (superseded_at IS NULL OR superseded_by_id = ?)
               AND EXISTS (
                 SELECT 1 FROM assets next
                 WHERE next.id = ? AND next.previous_version_id = assets.id
                   AND next.scope_id = assets.scope_id
                   AND next.context_key = assets.context_key
               )`
          )
          .bind(
            id,
            now,
            now,
            version.previousVersionId,
            version.scopeId,
            version.contextKey,
            id,
            id
          ),
        this.database
          .prepare(
            `UPDATE assets
             SET status = 'ready', summary = ?, error_message = NULL,
                 failed_at = NULL, processed_at = ?, updated_at = ?,
                 content_text = ?, raw_r2_key = ?, content_r2_key = ?
             WHERE id = ? AND record_kind = 'memory' AND scope_id = ?
               AND context_key = ? AND deleted_at IS NULL
               AND EXISTS (
                 SELECT 1 FROM assets previous
                 WHERE previous.id = ? AND previous.superseded_by_id = assets.id
               )`
          )
          .bind(
            input.summary,
            now,
            now,
            input.contentText ?? null,
            input.rawR2Key ?? null,
            input.contentR2Key ?? null,
            id,
            version.scopeId,
            version.contextKey,
            version.previousVersionId
          ),
      ]);

      if (
        (results[0]?.meta.changes ?? 0) !== 1 ||
        (results[1]?.meta.changes ?? 0) !== 1
      ) {
        throw new Error("Memory version activation could not be committed.");
      }

      return;
    }

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

    const [asset] = await this.db
      .select({
        recordKind: assets.recordKind,
        scopeId: assets.scopeId,
        contextKey: assets.contextKey,
      })
      .from(assets)
      .where(eq(assets.id, assetId))
      .limit(1);

    if (!asset) {
      throw new AssetNotFoundError(assetId);
    }

    const now = new Date().toISOString();
    const rows = chunks.map((chunk) => ({
      id: crypto.randomUUID(),
      assetId,
      recordKind: asset.recordKind,
      scopeId: asset.scopeId,
      contextKey: asset.contextKey ?? GLOBAL_CONTEXT_KEY,
      chunkIndex: chunk.chunkIndex,
      textPreview: chunk.textPreview,
      contentText: chunk.contentText,
      vectorId: chunk.vectorId ?? null,
      contentHash: chunk.contentHash ?? null,
      embeddingModel: chunk.embeddingModel ?? null,
      embeddingDim: chunk.embeddingDim ?? null,
      createdAt: now,
      updatedAt: now,
    }));

    // 这里按批写入，避开 Cloudflare D1 单条查询最多 100 个绑定参数的限制。
    for (const batch of splitIntoBatches(rows, 12)) {
      await this.db.insert(assetChunks).values(batch);
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

    if (input.aiVisibility !== undefined) {
      updatePayload.aiVisibility = input.aiVisibility;
    }

    if (input.retrievalPriority !== undefined) {
      updatePayload.retrievalPriority = input.retrievalPriority;
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
