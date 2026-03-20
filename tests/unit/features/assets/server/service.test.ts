import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetNotFoundError } from "@/core/assets/errors";
import type {
  AssetRepository,
  UpdateAssetMetadataInput,
} from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
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
    chunks: [],
    ...overrides,
  };
};

class InMemoryAssetRepository implements AssetRepository {
  private asset: AssetDetail;
  private deleted = false;

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
    if (this.deleted || id !== this.asset.id) {
      throw new AssetNotFoundError(id);
    }

    return structuredClone(this.asset);
  }

  public async searchAssets(): Promise<AssetListResult> {
    return this.listAssets();
  }

  public async getChunkMatchesByVectorIds() {
    return [];
  }

  public async listAssetIdsMissingChunkContent(): Promise<string[]> {
    return [];
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

  public async replaceAssetChunks(): Promise<void> {}

  public async failAssetProcessing(): Promise<void> {}

  public async markIngestJobRunning(): Promise<void> {}

  public async completeIngestJob(): Promise<void> {}

  public async failIngestJob(): Promise<void> {}

  public async updateAssetMetadata(
    id: string,
    input: UpdateAssetMetadataInput
  ): Promise<AssetDetail> {
    await this.getAssetById(id);

    this.asset = {
      ...this.asset,
      title: input.title ?? this.asset.title,
      summary: input.summary !== undefined ? input.summary : this.asset.summary,
      sourceUrl:
        input.sourceUrl !== undefined ? input.sourceUrl : this.asset.sourceUrl,
      source:
        this.asset.source && input.sourceUrl !== undefined
          ? {
              ...this.asset.source,
              sourceUrl: input.sourceUrl,
            }
          : this.asset.source,
    };

    return structuredClone(this.asset);
  }

  public async softDeleteAsset(id: string): Promise<void> {
    await this.getAssetById(id);
    this.deleted = true;
  }
}

describe("asset service", () => {
  const getAssetRepositoryMock = vi.fn();
  const getBlobStoreMock = vi.fn();
  const blobStoreMock: BlobStore = {
    put: vi.fn(),
    get: vi.fn(),
  };

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
      getBlobStore: getBlobStoreMock.mockResolvedValue(blobStoreMock),
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
      getBlobStore: getBlobStoreMock.mockResolvedValue(blobStoreMock),
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

  it("getAssetById hydrates full content from R2 when contentR2Key exists", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-detail-r2",
        title: "Hydrated asset",
        contentText: "Preview content",
        contentR2Key: "assets/asset-detail-r2/content/content.txt",
      })
    );
    const service = createAssetService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getBlobStore: getBlobStoreMock.mockResolvedValue({
        ...blobStoreMock,
        get: vi.fn().mockResolvedValue({
          key: "assets/asset-detail-r2/content/content.txt",
          body: new TextEncoder().encode("Full content from R2").buffer,
          size: 20,
          contentType: "text/plain; charset=utf-8",
        }),
      }),
    });

    const result = await service.getAssetById(
      { APP_NAME: "cloudmind-test" },
      "asset-detail-r2"
    );

    expect(result.contentText).toBe("Full content from R2");
  });

  it("updateAsset delegates to the repository and keeps hydrated content", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-edit-1",
        title: "Before edit",
        summary: "Old summary",
        contentText: "Preview content",
        contentR2Key: "assets/asset-edit-1/content/content.txt",
      })
    );
    const service = createAssetService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getBlobStore: getBlobStoreMock.mockResolvedValue({
        ...blobStoreMock,
        get: vi.fn().mockResolvedValue({
          key: "assets/asset-edit-1/content/content.txt",
          body: new TextEncoder().encode("Hydrated content").buffer,
          size: 15,
          contentType: "text/plain; charset=utf-8",
        }),
      }),
    });

    const result = await service.updateAsset(
      { APP_NAME: "cloudmind-test" },
      "asset-edit-1",
      {
        title: "After edit",
        summary: "Manual summary",
        sourceUrl: "https://example.com/edited",
      }
    );

    expect(result).toMatchObject({
      id: "asset-edit-1",
      title: "After edit",
      summary: "Manual summary",
      sourceUrl: "https://example.com/edited",
      contentText: "Hydrated content",
    });
  });

  it("deleteAsset delegates to the repository", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-delete-1",
      })
    );
    const service = createAssetService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getBlobStore: getBlobStoreMock.mockResolvedValue(blobStoreMock),
    });

    await service.deleteAsset({ APP_NAME: "cloudmind-test" }, "asset-delete-1");

    await expect(repository.getAssetById("asset-delete-1")).rejects.toThrow(
      AssetNotFoundError
    );
  });
});
