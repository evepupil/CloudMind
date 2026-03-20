import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AIProvider } from "@/core/ai/ports";
import type {
  AssetRepository,
  CreateFileAssetInput,
  CreateTextAssetInput,
  CreateUrlAssetInput,
} from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { WorkflowRepository } from "@/core/workflows/ports";
import type {
  AssetChunkMatch,
  AssetDetail,
  AssetListQuery,
  AssetListResult,
  AssetSourceKind,
  IngestJobSummary,
} from "@/features/assets/model/types";
import { createIngestService } from "@/features/ingest/server/service";

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
  private readonly missingChunkContentIds: string[];

  public constructor(asset: AssetDetail, missingChunkContentIds?: string[]) {
    this.asset = asset;
    this.missingChunkContentIds = missingChunkContentIds ?? [];
  }

  public async listAssets(_query?: AssetListQuery): Promise<AssetListResult> {
    return {
      items: [structuredClone(this.asset)],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    };
  }

  public async searchAssets(): Promise<AssetListResult> {
    return this.listAssets();
  }

  public async getChunkMatchesByVectorIds(): Promise<AssetChunkMatch[]> {
    return [];
  }

  public async getAssetById(id: string): Promise<AssetDetail> {
    if (id !== this.asset.id) {
      throw new Error(`Asset "${id}" not found.`);
    }

    return structuredClone(this.asset);
  }

  public async listAssetIdsMissingChunkContent(): Promise<string[]> {
    return [...this.missingChunkContentIds];
  }

  public async createTextAsset(
    input: CreateTextAssetInput
  ): Promise<AssetDetail> {
    this.asset = {
      ...this.asset,
      title: input.title?.trim() || this.asset.title,
      contentText: input.content,
      source: {
        kind: input.sourceKind ?? "manual",
        sourceUrl: null,
        metadataJson: null,
        createdAt: "2026-03-19T00:00:00.000Z",
      },
    };

    return structuredClone(this.asset);
  }

  public async createUrlAsset(
    input: CreateUrlAssetInput
  ): Promise<AssetDetail> {
    this.asset = {
      ...this.asset,
      type: "url",
      title: input.title?.trim() || input.url,
      sourceUrl: input.url,
      contentText: null,
      source: {
        kind: input.sourceKind ?? "manual",
        sourceUrl: input.url,
        metadataJson: null,
        createdAt: "2026-03-19T00:00:00.000Z",
      },
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
      contentText: null,
      rawR2Key: input.rawR2Key,
      contentR2Key: null,
      mimeType: input.mimeType,
      sourceUrl: null,
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
      jobs: [createJob()],
    };

    return structuredClone(this.asset);
  }

  public async markAssetProcessing(): Promise<void> {}

  public async completeAssetProcessing(): Promise<void> {}

  public async replaceAssetChunks(): Promise<void> {}

  public async failAssetProcessing(): Promise<void> {}

  public async markIngestJobRunning(): Promise<void> {}

  public async completeIngestJob(): Promise<void> {}

  public async failIngestJob(): Promise<void> {}
}

describe("ingest service", () => {
  const env = { APP_NAME: "cloudmind-test" };
  const blobStoreMock: BlobStore = {
    put: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
  };
  const vectorStoreMock: VectorStore = {
    upsert: vi.fn(async () => undefined),
    search: vi.fn(async () => []),
    deleteByIds: vi.fn(async () => undefined),
  };
  const aiProviderMock: AIProvider = {
    generateText: vi.fn(async () => ({
      text: "",
    })),
    createEmbeddings: vi.fn(async () => ({
      embeddings: [[0.11, 0.22]],
    })),
  };
  const getAssetRepositoryMock = vi.fn();
  const getBlobStoreMock = vi.fn();
  const getVectorStoreMock = vi.fn();
  const getWorkflowRepositoryMock = vi.fn();
  const getAIProviderMock = vi.fn();
  const workflowRepositoryMock = {} as WorkflowRepository;
  const processTextAssetMock = vi.fn();
  const processUrlAssetMock = vi.fn();
  const processPdfAssetMock = vi.fn();
  const processTextAssetForcedMock = vi.fn();
  const processUrlAssetForcedMock = vi.fn();
  const processPdfAssetForcedMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ingestTextAsset creates the asset and forwards it to the text processor", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-text-1",
        title: "Original title",
      })
    );
    const processedAsset = createAsset({
      id: "asset-text-1",
      title: "Service test asset",
      status: "ready",
      summary: "Processed summary",
      processedAt: "2026-03-19T00:02:00.000Z",
      jobs: [createJob({ status: "succeeded" })],
    });
    const service = createIngestService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getBlobStore: getBlobStoreMock.mockResolvedValue(blobStoreMock),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStoreMock),
      getWorkflowRepository: getWorkflowRepositoryMock.mockResolvedValue(
        workflowRepositoryMock
      ),
      getAIProvider: getAIProviderMock.mockResolvedValue(aiProviderMock),
      processTextAsset: processTextAssetMock.mockResolvedValue(processedAsset),
      processUrlAsset: processUrlAssetMock,
      processPdfAsset: processPdfAssetMock,
      getProcessTextAssetForced: processTextAssetForcedMock,
      getProcessUrlAssetForced: processUrlAssetForcedMock,
      getProcessPdfAssetForced: processPdfAssetForcedMock,
    });

    const result = await service.ingestTextAsset(env, {
      title: "Service test asset",
      content: "Service layer should create then process this note.",
    });

    expect(result).toEqual(processedAsset);
    expect(getAssetRepositoryMock).toHaveBeenCalledWith(env);
    expect(getBlobStoreMock).toHaveBeenCalledWith(env);
    expect(getVectorStoreMock).toHaveBeenCalledWith(env);
    expect(getWorkflowRepositoryMock).toHaveBeenCalledWith(env);
    expect(getAIProviderMock).toHaveBeenCalledWith(env);
    expect(processTextAssetMock).toHaveBeenCalledWith(
      repository,
      workflowRepositoryMock,
      blobStoreMock,
      vectorStoreMock,
      aiProviderMock,
      "asset-text-1"
    );
    expect(await repository.getAssetById("asset-text-1")).toMatchObject({
      title: "Service test asset",
      contentText: "Service layer should create then process this note.",
      source: {
        kind: "manual" satisfies AssetSourceKind,
      },
    });
  });

  it("ingestUrlAsset creates the asset and forwards it to the URL processor", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-url-1",
      })
    );
    const processedAsset = createAsset({
      id: "asset-url-1",
      type: "url",
      title: "Cloudflare Docs",
      sourceUrl: "https://developers.cloudflare.com",
      status: "ready",
      summary: "Saved URL asset for https://developers.cloudflare.com",
    });
    const service = createIngestService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getBlobStore: getBlobStoreMock.mockResolvedValue(blobStoreMock),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStoreMock),
      getWorkflowRepository: getWorkflowRepositoryMock.mockResolvedValue(
        workflowRepositoryMock
      ),
      getAIProvider: getAIProviderMock.mockResolvedValue(aiProviderMock),
      processTextAsset: processTextAssetMock,
      processUrlAsset: processUrlAssetMock.mockResolvedValue(processedAsset),
      processPdfAsset: processPdfAssetMock,
      getProcessTextAssetForced: processTextAssetForcedMock,
      getProcessUrlAssetForced: processUrlAssetForcedMock,
      getProcessPdfAssetForced: processPdfAssetForcedMock,
    });

    const result = await service.ingestUrlAsset(env, {
      title: "Cloudflare Docs",
      url: "https://developers.cloudflare.com",
    });

    expect(result).toEqual(processedAsset);
    expect(processUrlAssetMock).toHaveBeenCalledWith(repository, "asset-url-1");
    expect(await repository.getAssetById("asset-url-1")).toMatchObject({
      type: "url",
      title: "Cloudflare Docs",
      sourceUrl: "https://developers.cloudflare.com",
      source: {
        kind: "manual" satisfies AssetSourceKind,
      },
    });
  });

  it("ingestTextAsset keeps an explicit source kind for non-web entrypoints", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-text-mcp-1",
      })
    );
    const processedAsset = createAsset({
      id: "asset-text-mcp-1",
      status: "ready",
      source: {
        kind: "mcp",
        sourceUrl: null,
        metadataJson: null,
        createdAt: "2026-03-19T00:00:00.000Z",
      },
    });
    const service = createIngestService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getBlobStore: getBlobStoreMock.mockResolvedValue(blobStoreMock),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStoreMock),
      getWorkflowRepository: getWorkflowRepositoryMock.mockResolvedValue(
        workflowRepositoryMock
      ),
      getAIProvider: getAIProviderMock.mockResolvedValue(aiProviderMock),
      processTextAsset: processTextAssetMock.mockResolvedValue(processedAsset),
      processUrlAsset: processUrlAssetMock,
      processPdfAsset: processPdfAssetMock,
      getProcessTextAssetForced: processTextAssetForcedMock,
      getProcessUrlAssetForced: processUrlAssetForcedMock,
      getProcessPdfAssetForced: processPdfAssetForcedMock,
    });

    await service.ingestTextAsset(env, {
      title: "Saved from MCP",
      content: "Saved by remote AI tool",
      sourceKind: "mcp",
    });

    expect(await repository.getAssetById("asset-text-mcp-1")).toMatchObject({
      source: {
        kind: "mcp" satisfies AssetSourceKind,
      },
    });
  });

  it("ingestUrlAsset keeps an explicit source kind for non-web entrypoints", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-url-mcp-1",
      })
    );
    const processedAsset = createAsset({
      id: "asset-url-mcp-1",
      type: "url",
      status: "ready",
      source: {
        kind: "mcp",
        sourceUrl: "https://modelcontextprotocol.io",
        metadataJson: null,
        createdAt: "2026-03-19T00:00:00.000Z",
      },
    });
    const service = createIngestService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getBlobStore: getBlobStoreMock.mockResolvedValue(blobStoreMock),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStoreMock),
      getWorkflowRepository: getWorkflowRepositoryMock.mockResolvedValue(
        workflowRepositoryMock
      ),
      getAIProvider: getAIProviderMock.mockResolvedValue(aiProviderMock),
      processTextAsset: processTextAssetMock,
      processUrlAsset: processUrlAssetMock.mockResolvedValue(processedAsset),
      processPdfAsset: processPdfAssetMock,
      getProcessTextAssetForced: processTextAssetForcedMock,
      getProcessUrlAssetForced: processUrlAssetForcedMock,
      getProcessPdfAssetForced: processPdfAssetForcedMock,
    });

    await service.ingestUrlAsset(env, {
      title: "MCP Docs",
      url: "https://modelcontextprotocol.io",
      sourceKind: "mcp",
    });

    expect(await repository.getAssetById("asset-url-mcp-1")).toMatchObject({
      source: {
        kind: "mcp" satisfies AssetSourceKind,
      },
    });
  });

  it("ingestFileAsset uploads the file and forwards the created asset to the PDF processor", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("asset-file-1");

    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-original",
      })
    );
    const processedAsset = createAsset({
      id: "asset-file-1",
      type: "pdf",
      title: "CloudMind PDF",
      status: "ready",
      summary: "Hello CloudMind PDF",
      contentText: "Hello CloudMind PDF",
      rawR2Key: "assets/asset-file-1/raw/cloudmind.pdf",
      contentR2Key: "assets/asset-file-1/content/content.txt",
      mimeType: "application/pdf",
      jobs: [createJob({ status: "succeeded" })],
      chunks: [
        {
          id: "chunk-1",
          chunkIndex: 0,
          textPreview: "Hello CloudMind PDF",
          vectorId: "asset-file-1:0",
        },
      ],
    });
    const service = createIngestService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getBlobStore: getBlobStoreMock.mockResolvedValue(blobStoreMock),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStoreMock),
      getWorkflowRepository: getWorkflowRepositoryMock.mockResolvedValue(
        workflowRepositoryMock
      ),
      getAIProvider: getAIProviderMock.mockResolvedValue(aiProviderMock),
      processTextAsset: processTextAssetMock,
      processUrlAsset: processUrlAssetMock,
      processPdfAsset: processPdfAssetMock.mockResolvedValue(processedAsset),
      getProcessTextAssetForced: processTextAssetForcedMock,
      getProcessUrlAssetForced: processUrlAssetForcedMock,
      getProcessPdfAssetForced: processPdfAssetForcedMock,
    });
    const file = new File(["%PDF-1.7"], "cloudmind.pdf", {
      type: "application/pdf",
    });

    const result = await service.ingestFileAsset(env, {
      title: "CloudMind PDF",
      file,
    });

    expect(getBlobStoreMock).toHaveBeenCalledWith(env);
    expect(getVectorStoreMock).toHaveBeenCalledWith(env);
    expect(getAIProviderMock).toHaveBeenCalledWith(env);
    expect(blobStoreMock.put).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "assets/asset-file-1/raw/cloudmind.pdf",
        contentType: "application/pdf",
        contentDisposition: 'inline; filename="cloudmind.pdf"',
      })
    );
    expect(processPdfAssetMock).toHaveBeenCalledWith(
      repository,
      blobStoreMock,
      vectorStoreMock,
      aiProviderMock,
      "asset-file-1"
    );
    expect(result).toEqual(processedAsset);
  });

  it("reprocessAsset uses the text processor for note assets", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-note-1",
        type: "note",
      })
    );
    const processedAsset = createAsset({
      id: "asset-note-1",
      status: "ready",
      summary: "Reprocessed summary",
    });
    const service = createIngestService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getBlobStore: getBlobStoreMock.mockResolvedValue(blobStoreMock),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStoreMock),
      getWorkflowRepository: getWorkflowRepositoryMock.mockResolvedValue(
        workflowRepositoryMock
      ),
      getAIProvider: getAIProviderMock.mockResolvedValue(aiProviderMock),
      processTextAsset: processTextAssetMock,
      processUrlAsset: processUrlAssetMock,
      processPdfAsset: processPdfAssetMock,
      getProcessTextAssetForced:
        processTextAssetForcedMock.mockResolvedValue(processedAsset),
      getProcessUrlAssetForced: processUrlAssetForcedMock,
      getProcessPdfAssetForced: processPdfAssetForcedMock,
    });

    const result = await service.reprocessAsset(env, "asset-note-1");

    expect(processTextAssetForcedMock).toHaveBeenCalledWith(
      repository,
      workflowRepositoryMock,
      blobStoreMock,
      vectorStoreMock,
      aiProviderMock,
      "asset-note-1"
    );
    expect(result).toEqual(processedAsset);
  });

  it("reprocessAsset uses the PDF processor for pdf assets", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-pdf-1",
        type: "pdf",
        rawR2Key: "assets/asset-pdf-1/raw/cloudmind.pdf",
        mimeType: "application/pdf",
      })
    );
    const processedAsset = createAsset({
      id: "asset-pdf-1",
      type: "pdf",
      status: "ready",
      summary: "Hello CloudMind PDF",
      contentText: "Hello CloudMind PDF",
      rawR2Key: "assets/asset-pdf-1/raw/cloudmind.pdf",
      contentR2Key: "assets/asset-pdf-1/content/content.txt",
      mimeType: "application/pdf",
      chunks: [
        {
          id: "chunk-1",
          chunkIndex: 0,
          textPreview: "Hello CloudMind PDF",
          vectorId: "asset-pdf-1:0",
        },
      ],
    });
    const service = createIngestService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getBlobStore: getBlobStoreMock.mockResolvedValue(blobStoreMock),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStoreMock),
      getWorkflowRepository: getWorkflowRepositoryMock.mockResolvedValue(
        workflowRepositoryMock
      ),
      getAIProvider: getAIProviderMock.mockResolvedValue(aiProviderMock),
      processTextAsset: processTextAssetMock,
      processUrlAsset: processUrlAssetMock,
      processPdfAsset: processPdfAssetMock,
      getProcessTextAssetForced: processTextAssetForcedMock,
      getProcessUrlAssetForced: processUrlAssetForcedMock,
      getProcessPdfAssetForced:
        processPdfAssetForcedMock.mockResolvedValue(processedAsset),
    });

    const result = await service.reprocessAsset(env, "asset-pdf-1");

    expect(getBlobStoreMock).toHaveBeenCalledWith(env);
    expect(getVectorStoreMock).toHaveBeenCalledWith(env);
    expect(getAIProviderMock).toHaveBeenCalledWith(env);
    expect(processPdfAssetForcedMock).toHaveBeenCalledWith(
      repository,
      blobStoreMock,
      vectorStoreMock,
      aiProviderMock,
      "asset-pdf-1"
    );
    expect(result).toEqual(processedAsset);
  });

  it("reprocessAsset throws for unsupported asset types", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-image-1",
        type: "image",
      })
    );
    const service = createIngestService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getBlobStore: getBlobStoreMock.mockResolvedValue(blobStoreMock),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStoreMock),
      getWorkflowRepository: getWorkflowRepositoryMock.mockResolvedValue(
        workflowRepositoryMock
      ),
      getAIProvider: getAIProviderMock.mockResolvedValue(aiProviderMock),
      processTextAsset: processTextAssetMock,
      processUrlAsset: processUrlAssetMock,
      processPdfAsset: processPdfAssetMock,
      getProcessTextAssetForced: processTextAssetForcedMock,
      getProcessUrlAssetForced: processUrlAssetForcedMock,
      getProcessPdfAssetForced: processPdfAssetForcedMock,
    });

    await expect(service.reprocessAsset(env, "asset-image-1")).rejects.toThrow(
      'Asset type "image" is not supported for reprocess.'
    );
  });

  it("backfillChunkContent returns candidates without processing in dry-run mode", async () => {
    const repository = new InMemoryAssetRepository(createAsset(), [
      "asset-note-1",
      "asset-pdf-1",
    ]);
    const service = createIngestService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getBlobStore: getBlobStoreMock.mockResolvedValue(blobStoreMock),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStoreMock),
      getWorkflowRepository: getWorkflowRepositoryMock.mockResolvedValue(
        workflowRepositoryMock
      ),
      getAIProvider: getAIProviderMock.mockResolvedValue(aiProviderMock),
      processTextAsset: processTextAssetMock,
      processUrlAsset: processUrlAssetMock,
      processPdfAsset: processPdfAssetMock,
      getProcessTextAssetForced: processTextAssetForcedMock,
      getProcessUrlAssetForced: processUrlAssetForcedMock,
      getProcessPdfAssetForced: processPdfAssetForcedMock,
    });

    const result = await service.backfillChunkContent(env, {
      dryRun: true,
      limit: 10,
    });

    expect(result).toEqual({
      dryRun: true,
      candidateAssetIds: ["asset-note-1", "asset-pdf-1"],
      processedAssetIds: [],
      failedItems: [],
    });
    expect(processTextAssetForcedMock).not.toHaveBeenCalled();
    expect(processPdfAssetForcedMock).not.toHaveBeenCalled();
  });

  it("backfillChunkContent reprocesses candidate assets and records failures", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-note-1",
        type: "note",
      }),
      ["asset-note-1", "asset-missing-1"]
    );
    const processedAsset = createAsset({
      id: "asset-note-1",
      type: "note",
      status: "ready",
      summary: "Reprocessed summary",
    });
    const service = createIngestService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getBlobStore: getBlobStoreMock.mockResolvedValue(blobStoreMock),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStoreMock),
      getWorkflowRepository: getWorkflowRepositoryMock.mockResolvedValue(
        workflowRepositoryMock
      ),
      getAIProvider: getAIProviderMock.mockResolvedValue(aiProviderMock),
      processTextAsset: processTextAssetMock,
      processUrlAsset: processUrlAssetMock,
      processPdfAsset: processPdfAssetMock,
      getProcessTextAssetForced:
        processTextAssetForcedMock.mockResolvedValue(processedAsset),
      getProcessUrlAssetForced: processUrlAssetForcedMock,
      getProcessPdfAssetForced: processPdfAssetForcedMock,
    });

    const result = await service.backfillChunkContent(env, {
      dryRun: false,
      limit: 10,
    });

    expect(processTextAssetForcedMock).toHaveBeenCalledWith(
      repository,
      workflowRepositoryMock,
      blobStoreMock,
      vectorStoreMock,
      aiProviderMock,
      "asset-note-1"
    );
    expect(result).toEqual({
      dryRun: false,
      candidateAssetIds: ["asset-note-1", "asset-missing-1"],
      processedAssetIds: ["asset-note-1"],
      failedItems: [
        {
          assetId: "asset-missing-1",
          errorMessage: 'Asset "asset-missing-1" not found.',
        },
      ],
    });
  });
});
