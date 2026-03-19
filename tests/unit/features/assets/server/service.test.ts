import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AssetDetail,
  AssetSummary,
  IngestJobSummary,
} from "@/features/assets/model/types";
import type {
  AssetRepository,
  CreateTextAssetInput,
} from "@/features/assets/server/repository";
import { createAssetService } from "@/features/assets/server/service";

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

class InMemoryAssetRepository implements AssetRepository {
  private asset: AssetDetail;

  public constructor(asset: AssetDetail) {
    this.asset = asset;
  }

  public async listAssets(): Promise<AssetSummary[]> {
    return [this.asset];
  }

  public async getAssetById(id: string): Promise<AssetDetail> {
    if (id !== this.asset.id) {
      throw new Error(`Asset "${id}" not found.`);
    }

    return structuredClone(this.asset);
  }

  public async createTextAsset(
    input: CreateTextAssetInput
  ): Promise<AssetDetail> {
    this.asset = {
      ...this.asset,
      title: input.title?.trim() || this.asset.title,
      contentText: input.content,
    };

    return structuredClone(this.asset);
  }

  public async markAssetProcessing(_id: string): Promise<void> {}

  public async completeTextAssetProcessing(
    _id: string,
    _summary: string
  ): Promise<void> {}

  public async failAssetProcessing(
    _id: string,
    _message: string
  ): Promise<void> {}

  public async markIngestJobRunning(_jobId: string): Promise<void> {}

  public async completeIngestJob(_jobId: string): Promise<void> {}

  public async failIngestJob(_jobId: string, _message: string): Promise<void> {}
}

describe("asset service", () => {
  const processTextAssetMock = vi.fn();
  const getAssetRepositoryMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ingestTextAsset creates the asset and forwards it to the processor", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-service-1",
        title: "Original title",
      })
    );
    const processedAsset = createAsset({
      id: "asset-service-1",
      title: "Service test asset",
      status: "ready",
      summary: "Processed summary",
      processedAt: "2026-03-19T00:02:00.000Z",
      jobs: [createJob({ status: "succeeded" })],
    });
    const service = createAssetService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      processTextAsset: processTextAssetMock.mockResolvedValue(processedAsset),
    });

    const result = await service.ingestTextAsset(
      { APP_NAME: "cloudmind-test" },
      {
        title: "Service test asset",
        content: "Service layer should create then process this note.",
      }
    );

    expect(result).toEqual(processedAsset);
    expect(getAssetRepositoryMock).toHaveBeenCalledWith({
      APP_NAME: "cloudmind-test",
    });
    expect(processTextAssetMock).toHaveBeenCalledWith(
      repository,
      "asset-service-1"
    );
    expect(await repository.getAssetById("asset-service-1")).toMatchObject({
      title: "Service test asset",
      contentText: "Service layer should create then process this note.",
    });
  });

  it("listAssets delegates to the repository returned for the current bindings", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-list-1",
        title: "Asset list item",
        status: "ready",
        summary: "List summary",
      })
    );
    const service = createAssetService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      processTextAsset: processTextAssetMock,
    });

    const result = await service.listAssets({ APP_NAME: "cloudmind-test" });

    expect(result).toEqual([
      expect.objectContaining({
        id: "asset-list-1",
        title: "Asset list item",
      }),
    ]);
    expect(processTextAssetMock).not.toHaveBeenCalled();
  });
});
