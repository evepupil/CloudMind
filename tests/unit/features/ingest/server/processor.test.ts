import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { AIProvider } from "@/core/ai/ports";
import type {
  AssetRepository,
  AssetSearchInput,
  CreateFileAssetInput,
  CreateTextAssetInput,
  CreateUrlAssetInput,
} from "@/core/assets/ports";
import type { BlobObject, BlobStore } from "@/core/blob/ports";
import type {
  VectorRecord,
  VectorSearchInput,
  VectorSearchMatch,
  VectorStore,
} from "@/core/vector/ports";
import type {
  AssetChunkMatch,
  AssetDetail,
  AssetListQuery,
  AssetListResult,
  AssetSourceKind,
  IngestJobSummary,
} from "@/features/assets/model/types";
import {
  processPdfAsset,
  processTextAsset,
  processUrlAsset,
} from "@/features/ingest/server/processor";

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

const encodeArrayBuffer = (value: string): ArrayBuffer => {
  const encoded = new TextEncoder().encode(value);

  return encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength
  ) as ArrayBuffer;
};

const currentDir = dirname(fileURLToPath(import.meta.url));

const loadPdfFixture = async (name: string): Promise<ArrayBuffer> => {
  const file = await readFile(
    resolve(currentDir, "../../../../fixtures/ingest", name)
  );

  return file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength
  ) as ArrayBuffer;
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

  public constructor(asset: AssetDetail) {
    this.asset = asset;
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

  public async searchAssets(
    _input?: AssetSearchInput
  ): Promise<AssetListResult> {
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
    return [];
  }

  public async createTextAsset(
    input: CreateTextAssetInput
  ): Promise<AssetDetail> {
    this.asset.source = {
      kind: input.sourceKind ?? ("manual" satisfies AssetSourceKind),
      sourceUrl: null,
      metadataJson: null,
      createdAt: "2026-03-19T00:00:00.000Z",
    };
    return structuredClone(this.asset);
  }

  public async createUrlAsset(
    input: CreateUrlAssetInput
  ): Promise<AssetDetail> {
    this.asset.source = {
      kind: input.sourceKind ?? ("manual" satisfies AssetSourceKind),
      sourceUrl: input.url,
      metadataJson: null,
      createdAt: "2026-03-19T00:00:00.000Z",
    };
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
    input: {
      summary: string;
      contentText?: string | null;
      contentR2Key?: string | null;
    }
  ): Promise<void> {
    this.assertId(id);
    this.asset.status = "ready";
    this.asset.summary = input.summary;
    this.asset.errorMessage = null;
    this.asset.failedAt = null;
    this.asset.processedAt = "2026-03-19T00:02:00.000Z";
    this.asset.updatedAt = "2026-03-19T00:02:00.000Z";

    if (input.contentText !== undefined) {
      this.asset.contentText = input.contentText;
    }

    if (input.contentR2Key !== undefined) {
      this.asset.contentR2Key = input.contentR2Key;
    }
  }

  public async replaceAssetChunks(
    _assetId: string,
    chunks: Array<{
      chunkIndex: number;
      textPreview: string;
      contentText: string;
      vectorId?: string | null;
    }>
  ): Promise<void> {
    this.asset.chunks = chunks.map((chunk, index) => ({
      id: `chunk-${index + 1}`,
      chunkIndex: chunk.chunkIndex,
      textPreview: chunk.textPreview,
      contentText: chunk.contentText,
      vectorId: chunk.vectorId ?? null,
    }));
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

class InMemoryBlobStore implements BlobStore {
  private readonly objects = new Map<string, BlobObject>();

  public constructor(objects: BlobObject[] = []) {
    for (const object of objects) {
      this.objects.set(object.key, object);
    }
  }

  public async put(input: {
    key: string;
    body: ArrayBuffer;
    contentType?: string | undefined;
  }): Promise<void> {
    this.objects.set(input.key, {
      key: input.key,
      body: input.body,
      size: input.body.byteLength,
      contentType: input.contentType,
    });
  }

  public async get(key: string): Promise<BlobObject | null> {
    return this.objects.get(key) ?? null;
  }
}

class InMemoryVectorStore implements VectorStore {
  public readonly upsertCalls: VectorRecord[][] = [];

  public readonly deletedIds: string[][] = [];

  public async upsert(records: VectorRecord[]): Promise<void> {
    this.upsertCalls.push(records);
  }

  public async search(_input: VectorSearchInput): Promise<VectorSearchMatch[]> {
    return [];
  }

  public async deleteByIds(ids: string[]): Promise<void> {
    this.deletedIds.push(ids);
  }
}

class InMemoryAIProvider implements AIProvider {
  public async generateText(): Promise<{ text: string }> {
    return { text: "" };
  }

  public async createEmbeddings(input: {
    texts: string[];
  }): Promise<{ embeddings: number[][] }> {
    return {
      embeddings: input.texts.map((_, index) => [index + 0.1, index + 0.2]),
    };
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
    const blobStore = new InMemoryBlobStore();
    const vectorStore = new InMemoryVectorStore();
    const aiProvider = new InMemoryAIProvider();

    const result = await processTextAsset(
      repository,
      blobStore,
      vectorStore,
      aiProvider,
      "asset-1"
    );

    expect(result.status).toBe("ready");
    expect(result.summary).toBe(
      "CloudMind keeps the original content and generates a concise summary."
    );
    expect(result.contentR2Key).toBe("assets/asset-1/content/content.txt");
    expect(result.contentText).toBe(
      "CloudMind keeps the original content and generates a concise summary."
    );
    expect(result.chunks).toEqual([
      {
        id: "chunk-1",
        chunkIndex: 0,
        textPreview:
          "CloudMind keeps the original content and generates a concise summary.",
        contentText:
          "CloudMind keeps the original content and generates a concise summary.",
        vectorId: "asset-1:0",
      },
    ]);
    expect(result.processedAt).toBe("2026-03-19T00:02:00.000Z");
    expect(result.jobs[0]?.status).toBe("succeeded");
    expect(result.jobs[0]?.errorMessage).toBeNull();
    expect(vectorStore.upsertCalls).toEqual([
      [
        expect.objectContaining({
          id: "asset-1:0",
        }),
      ],
    ]);
  });

  it("marks the asset and job as failed when content is empty", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        contentText: "   ",
      })
    );
    const blobStore = new InMemoryBlobStore();
    const vectorStore = new InMemoryVectorStore();
    const aiProvider = new InMemoryAIProvider();

    const result = await processTextAsset(
      repository,
      blobStore,
      vectorStore,
      aiProvider,
      "asset-1"
    );

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
    const blobStore = new InMemoryBlobStore();
    const vectorStore = new InMemoryVectorStore();
    const aiProvider = new InMemoryAIProvider();

    const result = await processTextAsset(
      repository,
      blobStore,
      vectorStore,
      aiProvider,
      "asset-1"
    );

    expect(result.status).toBe("ready");
    expect(result.summary).toBe("Existing summary");
    expect(result.jobs[0]?.status).toBe("succeeded");
  });
});

describe("processUrlAsset", () => {
  it("summarizes the saved URL and completes the latest job", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-url-1",
        type: "url",
        title: "Cloudflare Docs",
        contentText: null,
        sourceUrl: "https://developers.cloudflare.com",
      })
    );

    const result = await processUrlAsset(repository, "asset-url-1");

    expect(result.status).toBe("ready");
    expect(result.summary).toBe(
      "Saved URL asset for https://developers.cloudflare.com"
    );
    expect(result.jobs[0]?.status).toBe("succeeded");
  });
});

describe("processPdfAsset", () => {
  it("extracts real text from the PDF in R2 and promotes the asset to ready", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-pdf-1",
        type: "pdf",
        title: "CloudMind Whitepaper",
        contentText: null,
        rawR2Key: "assets/asset-pdf-1/raw/cloudmind.pdf",
        mimeType: "application/pdf",
      })
    );
    const pdfBody = await loadPdfFixture("hello-cloudmind.pdf");
    const blobStore = new InMemoryBlobStore([
      {
        key: "assets/asset-pdf-1/raw/cloudmind.pdf",
        body: pdfBody,
        size: pdfBody.byteLength,
        contentType: "application/pdf",
      },
    ]);
    const vectorStore = new InMemoryVectorStore();
    const aiProvider = new InMemoryAIProvider();

    const result = await processPdfAsset(
      repository,
      blobStore,
      vectorStore,
      aiProvider,
      "asset-pdf-1"
    );

    expect(result.status).toBe("ready");
    expect(result.summary).toBe("Hello CloudMind PDF");
    expect(result.contentText).toBe("Hello CloudMind PDF");
    expect(result.contentR2Key).toBe("assets/asset-pdf-1/content/content.txt");
    expect(result.chunks).toEqual([
      {
        id: "chunk-1",
        chunkIndex: 0,
        textPreview: "Hello CloudMind PDF",
        contentText: "Hello CloudMind PDF",
        vectorId: "asset-pdf-1:0",
      },
    ]);
    expect(result.jobs[0]?.status).toBe("succeeded");
    expect(vectorStore.upsertCalls).toEqual([
      [
        expect.objectContaining({
          id: "asset-pdf-1:0",
        }),
      ],
    ]);
  });

  it("marks the asset as failed when the R2 object is missing", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-pdf-missing",
        type: "pdf",
        contentText: null,
        rawR2Key: "assets/asset-pdf-missing/raw/missing.pdf",
        mimeType: "application/pdf",
      })
    );
    const blobStore = new InMemoryBlobStore();
    const vectorStore = new InMemoryVectorStore();
    const aiProvider = new InMemoryAIProvider();

    const result = await processPdfAsset(
      repository,
      blobStore,
      vectorStore,
      aiProvider,
      "asset-pdf-missing"
    );

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe(
      "Asset file was not found in blob storage."
    );
    expect(result.jobs[0]?.status).toBe("failed");
  });

  it("marks the asset as failed when the uploaded file is not a PDF", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-pdf-invalid",
        type: "pdf",
        contentText: null,
        rawR2Key: "assets/asset-pdf-invalid/raw/not-a-pdf.pdf",
        mimeType: "application/pdf",
      })
    );
    const blobStore = new InMemoryBlobStore([
      {
        key: "assets/asset-pdf-invalid/raw/not-a-pdf.pdf",
        body: encodeArrayBuffer("NOTPDF"),
        size: 6,
        contentType: "application/pdf",
      },
    ]);
    const vectorStore = new InMemoryVectorStore();
    const aiProvider = new InMemoryAIProvider();

    const result = await processPdfAsset(
      repository,
      blobStore,
      vectorStore,
      aiProvider,
      "asset-pdf-invalid"
    );

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("Uploaded file is not a valid PDF.");
    expect(result.jobs[0]?.status).toBe("failed");
  });

  it("marks the asset as failed when PDF text extraction fails", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-pdf-broken",
        type: "pdf",
        contentText: null,
        rawR2Key: "assets/asset-pdf-broken/raw/broken.pdf",
        mimeType: "application/pdf",
      })
    );
    const blobStore = new InMemoryBlobStore([
      {
        key: "assets/asset-pdf-broken/raw/broken.pdf",
        body: encodeArrayBuffer("%PDF-broken"),
        size: 11,
        contentType: "application/pdf",
      },
    ]);
    const vectorStore = new InMemoryVectorStore();
    const aiProvider = new InMemoryAIProvider();

    const result = await processPdfAsset(
      repository,
      blobStore,
      vectorStore,
      aiProvider,
      "asset-pdf-broken"
    );

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("Failed to extract text from PDF.");
    expect(result.jobs[0]?.status).toBe("failed");
  });
});
