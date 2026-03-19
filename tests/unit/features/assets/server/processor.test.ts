import { describe, expect, it } from "vitest";

import type {
  AssetDetail,
  AssetListQuery,
  AssetListResult,
  IngestJobSummary,
} from "@/features/assets/model/types";
import { processTextAsset } from "@/features/assets/server/processor";
import type {
  AssetRepository,
  CreateFileAssetInput,
  CreateTextAssetInput,
} from "@/features/assets/server/repository";

const createJob = (
  overrides: Partial<IngestJobSummary> = {}
): IngestJobSummary => {
  return {
    id: "job-1",
    jobType: "extract_content",
    status: "queued",
    attempt: 0,
    errorMessage: null,
    createdAt: "2026-03-19T00:00:00.000Z",
    updatedAt: "2026-03-19T00:00:00.000Z",
    ...overrides,
  };
};

const createAsset = (overrides: Partial<AssetDetail> = {}): AssetDetail => {
  return {
    id: "asset-1",
    type: "note",
    title: "Test asset",
    summary: null,
    sourceUrl: null,
    status: "pending",
    createdAt: "2026-03-19T00:00:00.000Z",
    updatedAt: "2026-03-19T00:00:00.000Z",
    contentText: "Default content",
    mimeType: "text/plain",
    language: null,
    errorMessage: null,
    processedAt: null,
    failedAt: null,
    source: {
      kind: "manual",
      sourceUrl: null,
      metadataJson: null,
      createdAt: "2026-03-19T00:00:00.000Z",
    },
    jobs: [createJob()],
    ...overrides,
  };
};

// 这里用内存版仓储替代 D1，专注验证处理器的状态流转而不是基础设施。
class InMemoryAssetRepository implements AssetRepository {
  private asset: AssetDetail;

  public constructor(asset: AssetDetail) {
    this.asset = asset;
  }

  public async listAssets(_query?: AssetListQuery): Promise<AssetListResult> {
    return {
      items: [this.asset],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    };
  }

  public async getAssetById(id: string): Promise<AssetDetail> {
    if (id !== this.asset.id) {
      throw new Error(`Asset "${id}" not found.`);
    }

    return structuredClone(this.asset);
  }

  public async createTextAsset(
    _input: CreateTextAssetInput
  ): Promise<AssetDetail> {
    return structuredClone(this.asset);
  }

  public async createUrlAsset(): Promise<AssetDetail> {
    return structuredClone(this.asset);
  }

  public async createFileAsset(
    _input: CreateFileAssetInput
  ): Promise<AssetDetail> {
    return structuredClone(this.asset);
  }

  public async markAssetProcessing(id: string): Promise<void> {
    this.assertId(id);
    this.asset.status = "processing";
    this.asset.errorMessage = null;
    this.asset.failedAt = null;
    this.asset.updatedAt = "2026-03-19T00:01:00.000Z";
  }

  public async completeAssetProcessing(
    id: string,
    summary: string
  ): Promise<void> {
    this.assertId(id);
    this.asset.status = "ready";
    this.asset.summary = summary;
    this.asset.errorMessage = null;
    this.asset.failedAt = null;
    this.asset.processedAt = "2026-03-19T00:02:00.000Z";
    this.asset.updatedAt = "2026-03-19T00:02:00.000Z";
  }

  public async failAssetProcessing(id: string, message: string): Promise<void> {
    this.assertId(id);
    this.asset.status = "failed";
    this.asset.errorMessage = message;
    this.asset.failedAt = "2026-03-19T00:03:00.000Z";
    this.asset.updatedAt = "2026-03-19T00:03:00.000Z";
  }

  public async markIngestJobRunning(jobId: string): Promise<void> {
    const job = this.getJob(jobId);
    job.status = "running";
    job.errorMessage = null;
    job.updatedAt = "2026-03-19T00:01:00.000Z";
  }

  public async completeIngestJob(jobId: string): Promise<void> {
    const job = this.getJob(jobId);
    job.status = "succeeded";
    job.errorMessage = null;
    job.updatedAt = "2026-03-19T00:02:00.000Z";
  }

  public async failIngestJob(jobId: string, message: string): Promise<void> {
    const job = this.getJob(jobId);
    job.status = "failed";
    job.errorMessage = message;
    job.updatedAt = "2026-03-19T00:03:00.000Z";
  }

  private assertId(id: string): void {
    if (id !== this.asset.id) {
      throw new Error(`Unexpected asset id "${id}".`);
    }
  }

  private getJob(jobId: string): IngestJobSummary {
    const job = this.asset.jobs.find((item) => item.id === jobId);

    if (!job) {
      throw new Error(`Unexpected job id "${jobId}".`);
    }

    return job;
  }
}

describe("processTextAsset", () => {
  it("promotes a pending text asset to ready and completes the latest job", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        contentText:
          "  CloudMind keeps the original content and generates a concise summary.  ",
      })
    );

    const result = await processTextAsset(repository, "asset-1");

    expect(result.status).toBe("ready");
    expect(result.summary).toBe(
      "CloudMind keeps the original content and generates a concise summary."
    );
    expect(result.processedAt).toBe("2026-03-19T00:02:00.000Z");
    expect(result.jobs[0]?.status).toBe("succeeded");
    expect(result.jobs[0]?.errorMessage).toBeNull();
  });

  it("marks the asset and job as failed when content is empty", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        contentText: "   ",
      })
    );

    const result = await processTextAsset(repository, "asset-1");

    expect(result.status).toBe("failed");
    expect(result.summary).toBeNull();
    expect(result.errorMessage).toBe(
      "Asset content is empty and cannot be processed."
    );
    expect(result.jobs[0]?.status).toBe("failed");
    expect(result.jobs[0]?.errorMessage).toBe(
      "Asset content is empty and cannot be processed."
    );
  });

  it("returns early for assets that are already ready", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        status: "ready",
        summary: "Existing summary",
        jobs: [createJob({ status: "succeeded" })],
      })
    );

    const result = await processTextAsset(repository, "asset-1");

    expect(result.status).toBe("ready");
    expect(result.summary).toBe("Existing summary");
    expect(result.jobs[0]?.status).toBe("succeeded");
  });
});
