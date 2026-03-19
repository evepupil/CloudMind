import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AssetDetail,
  AssetListQuery,
  AssetListResult,
  IngestJobSummary,
} from "@/features/assets/model/types";
import type { BlobStore } from "@/features/assets/server/blob-store";
import type {
  AssetRepository,
  CreateFileAssetInput,
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

  public async createUrlAsset(input: {
    title?: string | undefined;
    url: string;
  }): Promise<AssetDetail> {
    this.asset = {
      ...this.asset,
      type: "url",
      title: input.title?.trim() || input.url,
      sourceUrl: input.url,
      contentText: null,
    };

    return structuredClone(this.asset);
  }

  public async createFileAsset(
    input: CreateFileAssetInput
  ): Promise<AssetDetail> {
    this.asset = {
      ...this.asset,
      id: input.id,
      type: "pdf",
      title: input.title?.trim() || input.fileName,
      sourceUrl: null,
      status: "pending",
      contentText: null,
      rawR2Key: input.rawR2Key,
      contentR2Key: null,
      mimeType: input.mimeType,
      source: {
        kind: "upload",
        sourceUrl: null,
        metadataJson: JSON.stringify({
          fileName: input.fileName,
          fileSize: input.fileSize,
          rawR2Key: input.rawR2Key,
        }),
        createdAt: "2026-03-19T00:00:00.000Z",
      },
      jobs: [
        createJob({
          jobType: "extract_content",
          status: "queued",
        }),
      ],
    };

    return structuredClone(this.asset);
  }

  public async markAssetProcessing(_id: string): Promise<void> {}

  public async completeAssetProcessing(
    _id: string,
    _summary: string,
    _contentText?: string | null
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
  const processPdfAssetMock = vi.fn();
  const blobStoreMock: BlobStore = {
    put: vi.fn(),
    get: vi.fn(),
  };
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
      getBlobStore: vi.fn().mockResolvedValue(blobStoreMock),
      processTextAsset: processTextAssetMock.mockResolvedValue(processedAsset),
      processUrlAsset: vi.fn(),
      processPdfAsset: processPdfAssetMock,
      getProcessTextAssetForced: vi.fn(),
      getProcessUrlAssetForced: vi.fn(),
      getProcessPdfAssetForced: vi.fn(),
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
      getBlobStore: vi.fn().mockResolvedValue(blobStoreMock),
      processTextAsset: processTextAssetMock,
      processUrlAsset: vi.fn(),
      processPdfAsset: processPdfAssetMock,
      getProcessTextAssetForced: vi.fn(),
      getProcessUrlAssetForced: vi.fn(),
      getProcessPdfAssetForced: vi.fn(),
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
    expect(processTextAssetMock).not.toHaveBeenCalled();
  });

  it("ingestFileAsset uploads the file and forwards the created asset to the PDF processor", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-original",
      })
    );
    const getBlobStoreMock = vi.fn().mockResolvedValue(blobStoreMock);
    const processedAsset = createAsset({
      id: "asset-file-1",
      type: "pdf",
      title: "CloudMind PDF",
      status: "ready",
      summary: "Verified PDF asset in R2 (8 bytes).",
      contentText: "PDF placeholder content",
      rawR2Key: "assets/asset-file-1/raw/cloudmind.pdf",
      mimeType: "application/pdf",
      jobs: [createJob({ status: "succeeded" })],
    });
    const service = createAssetService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getBlobStore: getBlobStoreMock,
      processTextAsset: processTextAssetMock,
      processUrlAsset: vi.fn(),
      processPdfAsset: processPdfAssetMock.mockResolvedValue(processedAsset),
      getProcessTextAssetForced: vi.fn(),
      getProcessUrlAssetForced: vi.fn(),
      getProcessPdfAssetForced: vi.fn(),
    });
    const file = new File(["%PDF-1.7"], "cloudmind.pdf", {
      type: "application/pdf",
    });

    const result = await service.ingestFileAsset(
      { APP_NAME: "cloudmind-test" },
      {
        title: "CloudMind PDF",
        file,
      }
    );

    expect(getBlobStoreMock).toHaveBeenCalledWith({
      APP_NAME: "cloudmind-test",
    });
    expect(blobStoreMock.put).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(/^assets\/.+\/raw\/cloudmind\.pdf$/),
        contentType: "application/pdf",
        contentDisposition: 'inline; filename="cloudmind.pdf"',
      })
    );
    expect(processPdfAssetMock).toHaveBeenCalledWith(
      repository,
      blobStoreMock,
      expect.any(String)
    );
    expect(result).toEqual(processedAsset);
  });

  it("reprocessAsset uses the PDF processor for pdf assets", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-pdf-1",
        type: "pdf",
        title: "CloudMind PDF",
        rawR2Key: "assets/asset-pdf-1/raw/cloudmind.pdf",
        mimeType: "application/pdf",
      })
    );
    const getBlobStoreMock = vi.fn().mockResolvedValue(blobStoreMock);
    const processedAsset = createAsset({
      id: "asset-pdf-1",
      type: "pdf",
      status: "ready",
      summary: "Verified PDF asset in R2 (8 bytes).",
      rawR2Key: "assets/asset-pdf-1/raw/cloudmind.pdf",
      mimeType: "application/pdf",
    });
    const getProcessPdfAssetForcedMock = vi
      .fn()
      .mockResolvedValue(processedAsset);
    const service = createAssetService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getBlobStore: getBlobStoreMock,
      processTextAsset: processTextAssetMock,
      processUrlAsset: vi.fn(),
      processPdfAsset: processPdfAssetMock,
      getProcessTextAssetForced: vi.fn(),
      getProcessUrlAssetForced: vi.fn(),
      getProcessPdfAssetForced: getProcessPdfAssetForcedMock,
    });

    const result = await service.reprocessAsset(
      { APP_NAME: "cloudmind-test" },
      "asset-pdf-1"
    );

    expect(getBlobStoreMock).toHaveBeenCalledWith({
      APP_NAME: "cloudmind-test",
    });
    expect(getProcessPdfAssetForcedMock).toHaveBeenCalledWith(
      repository,
      blobStoreMock,
      "asset-pdf-1"
    );
    expect(result).toEqual(processedAsset);
  });
});
