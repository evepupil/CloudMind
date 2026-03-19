import { and, asc, count, desc, eq, inArray, like, or } from "drizzle-orm";

import { AssetNotFoundError } from "@/core/assets/errors";
import type {
  AssetRepository,
  AssetSearchInput,
  CompleteAssetProcessingInput,
  CreateAssetChunkInput,
  CreateFileAssetInput,
  CreateTextAssetInput,
  CreateUrlAssetInput,
} from "@/core/assets/ports";
import type {
  AssetChunkMatch,
  AssetChunkSummary,
  AssetDetail,
  AssetListQuery,
  AssetListResult,
  AssetSourceKind,
  AssetSummary,
  AssetType,
  IngestJobSummary,
} from "@/features/assets/model/types";
import { createDb } from "@/platform/db/d1/client";
import {
  assetChunks,
  assetSources,
  assets,
  ingestJobs,
} from "@/platform/db/d1/schema";

const mapAssetSummary = (record: typeof assets.$inferSelect): AssetSummary => {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    summary: record.summary,
    sourceUrl: record.sourceUrl,
    status: record.status,
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

const buildAssetListWhereClause = (query?: AssetListQuery) => {
  const conditions = [];

  if (query?.status) {
    conditions.push(eq(assets.status, query.status));
  }

  if (query?.type) {
    conditions.push(eq(assets.type, query.type));
  }

  if (query?.query) {
    const search = `%${query.query}%`;
    conditions.push(
      or(
        like(assets.title, search),
        like(assets.summary, search),
        like(assets.sourceUrl, search)
      )
    );
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

  public async getChunkMatchesByVectorIds(
    vectorIds: string[]
  ): Promise<AssetChunkMatch[]> {
    if (vectorIds.length === 0) {
      return [];
    }

    const records = await this.db
      .select({
        chunk: assetChunks,
        asset: assets,
      })
      .from(assetChunks)
      .innerJoin(assets, eq(assetChunks.assetId, assets.id))
      .where(inArray(assetChunks.vectorId, vectorIds));

    return records.map(mapChunkMatch);
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
          inArray(assets.status, ["ready", "failed"])
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
      .where(eq(assets.id, id))
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

    await this.db.insert(assets).values({
      id: assetId,
      type: "note" satisfies AssetType,
      title,
      summary: null,
      sourceUrl: null,
      status: "pending",
      contentText: input.content,
      rawR2Key: null,
      contentR2Key: null,
      mimeType: "text/plain",
      language: null,
      errorMessage: null,
      processedAt: null,
      failedAt: null,
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
      status: "pending",
      contentText: null,
      rawR2Key: null,
      contentR2Key: null,
      mimeType: "text/html",
      language: null,
      errorMessage: null,
      processedAt: null,
      failedAt: null,
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
      status: "pending",
      contentText: null,
      rawR2Key: input.rawR2Key,
      contentR2Key: null,
      mimeType: input.mimeType,
      language: null,
      errorMessage: null,
      processedAt: null,
      failedAt: null,
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
}
