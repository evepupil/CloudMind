import { desc, eq } from "drizzle-orm";

import { createDb } from "@/db/client";
import { assetSources, assets, ingestJobs } from "@/db/schema";
import type {
  AssetDetail,
  AssetSourceKind,
  AssetSummary,
  AssetType,
  IngestJobSummary,
} from "@/features/assets/model/types";
import {
  AssetNotFoundError,
  type AssetRepository,
  type CreateTextAssetInput,
} from "@/features/assets/server/repository";

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

// 这里实现面向 D1 的资产仓储；后续如果切换存储实现，只替换这一层。
export class D1AssetRepository implements AssetRepository {
  private readonly db: ReturnType<typeof createDb>;

  public constructor(database: D1Database) {
    this.db = createDb(database);
  }

  public async listAssets(): Promise<AssetSummary[]> {
    const records = await this.db
      .select()
      .from(assets)
      .orderBy(desc(assets.createdAt));

    return records.map(mapAssetSummary);
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

    return {
      ...mapAssetSummary(assetRecord),
      contentText: assetRecord.contentText,
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
      kind: "manual",
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

  public async completeTextAssetProcessing(
    id: string,
    summary: string
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(assets)
      .set({
        status: "ready",
        summary,
        errorMessage: null,
        failedAt: null,
        processedAt: now,
        updatedAt: now,
      })
      .where(eq(assets.id, id));
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
