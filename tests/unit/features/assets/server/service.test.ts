import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AssetRepository } from "@/core/assets/ports";
import type {
  AssetDetail,
  AssetListQuery,
  AssetListResult,
  IngestJobSummary,
} from "@/features/assets/model/types";
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
    rawR2Key: null,
    contentR2Key: null,
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

  public async createTextAsset(): Promise<AssetDetail> {
    return structuredClone(this.asset);
  }

  public async createUrlAsset(): Promise<AssetDetail> {
    return structuredClone(this.asset);
  }

  public async createFileAsset(): Promise<AssetDetail> {
    return structuredClone(this.asset);
  }

  public async markAssetProcessing(): Promise<void> {}

  public async completeAssetProcessing(): Promise<void> {}

  public async failAssetProcessing(): Promise<void> {}

  public async markIngestJobRunning(): Promise<void> {}

  public async completeIngestJob(): Promise<void> {}

  public async failIngestJob(): Promise<void> {}
}

describe("asset service", () => {
  const getAssetRepositoryMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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
    });

    const result = await service.listAssets({ APP_NAME: "cloudmind-test" });

    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: "asset-list-1",
          title: "Asset list item",
        }),
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it("getAssetById delegates to the repository returned for the current bindings", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-detail-1",
        title: "Asset detail item",
      })
    );
    const service = createAssetService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
    });

    const result = await service.getAssetById(
      { APP_NAME: "cloudmind-test" },
      "asset-detail-1"
    );

    expect(result).toMatchObject({
      id: "asset-detail-1",
      title: "Asset detail item",
    });
  });

  it("searchAssets delegates to the repository query search", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-search-1",
        title: "CloudMind Search Item",
      })
    );
    const listAssetsSpy = vi.spyOn(repository, "listAssets");
    const service = createAssetService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
    });

    await service.searchAssets(
      { APP_NAME: "cloudmind-test" },
      {
        query: "cloudmind",
        page: 2,
        pageSize: 10,
      }
    );

    expect(listAssetsSpy).toHaveBeenCalledWith({
      query: "cloudmind",
      page: 2,
      pageSize: 10,
    });
  });
});
