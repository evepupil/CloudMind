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
import type { JobQueue, JobQueueMessage } from "@/core/queue/ports";
import type {
  VectorRecord,
  VectorSearchInput,
  VectorSearchMatch,
  VectorStore,
} from "@/core/vector/ports";
import type { WebPageFetcher, WebPageFetchResult } from "@/core/web/ports";
import type {
  CreateAssetArtifactInput,
  CreateWorkflowRunInput,
  CreateWorkflowStepInput,
  WorkflowRepository,
} from "@/core/workflows/ports";
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
import type {
  AssetArtifactRecord,
  WorkflowRunRecord,
  WorkflowStepRecord,
} from "@/features/workflows/model/types";
import { getWorkflowDefinition } from "@/features/workflows/server/registry";
import {
  consumeWorkflowStepMessage,
  parseWorkflowStepQueuePayload,
} from "@/features/workflows/server/runtime";

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
    sourceKind: "manual",
    status: "pending",
    domain: "general",
    sensitivity: "internal",
    aiVisibility: "allow",
    retrievalPriority: 0,
    collectionKey: "inbox:notes",
    capturedAt: "2026-03-19T00:00:00.000Z",
    descriptorJson: null,
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

  public async searchAssetSummaries() {
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
    this.asset.sourceKind =
      input.sourceKind ?? ("manual" satisfies AssetSourceKind);
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
    this.asset.sourceKind =
      input.sourceKind ?? ("manual" satisfies AssetSourceKind);
    this.asset.sourceUrl = input.url;
    return structuredClone(this.asset);
  }

  public async createFileAsset(
    _input: CreateFileAssetInput
  ): Promise<AssetDetail> {
    this.asset.sourceKind = "upload";
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
      rawR2Key?: string | null;
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

    if (input.rawR2Key !== undefined) {
      this.asset.rawR2Key = input.rawR2Key;
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

  public async updateAssetIndexing(
    id: string,
    input: {
      sourceKind?: AssetSourceKind | null | undefined;
      domain?: AssetDetail["domain"] | undefined;
      sensitivity?: AssetDetail["sensitivity"] | undefined;
      aiVisibility?: AssetDetail["aiVisibility"] | undefined;
      retrievalPriority?: number | undefined;
      documentClass?: AssetDetail["documentClass"] | null | undefined;
      sourceHost?: AssetDetail["sourceHost"] | null | undefined;
      collectionKey?: string | null | undefined;
      capturedAt?: string | null | undefined;
      descriptorJson?: string | null | undefined;
    }
  ): Promise<void> {
    this.assertId(id);

    this.asset = {
      ...this.asset,
      sourceKind:
        input.sourceKind !== undefined
          ? input.sourceKind
          : this.asset.sourceKind,
      domain: input.domain ?? this.asset.domain,
      sensitivity: input.sensitivity ?? this.asset.sensitivity,
      aiVisibility: input.aiVisibility ?? this.asset.aiVisibility,
      retrievalPriority:
        input.retrievalPriority ?? this.asset.retrievalPriority,
      documentClass:
        input.documentClass !== undefined
          ? input.documentClass
          : this.asset.documentClass,
      sourceHost:
        input.sourceHost !== undefined
          ? input.sourceHost
          : this.asset.sourceHost,
      collectionKey:
        input.collectionKey !== undefined
          ? input.collectionKey
          : this.asset.collectionKey,
      capturedAt:
        input.capturedAt !== undefined
          ? input.capturedAt
          : this.asset.capturedAt,
      descriptorJson:
        input.descriptorJson !== undefined
          ? input.descriptorJson
          : this.asset.descriptorJson,
    };
  }

  public async replaceAssetFacets(
    id: string,
    facets: Array<{
      facetKey: string;
      facetValue: string;
      facetLabel: string;
      sortOrder?: number | undefined;
    }>
  ): Promise<void> {
    this.assertId(id);
    this.asset.facets = facets.map((facet, index) => ({
      id: `facet-${index + 1}`,
      facetKey: facet.facetKey as NonNullable<
        AssetDetail["facets"]
      >[number]["facetKey"],
      facetValue: facet.facetValue,
      facetLabel: facet.facetLabel,
      sortOrder: facet.sortOrder ?? index,
    }));
  }

  public async replaceAssetAssertions(
    id: string,
    assertions: Array<{
      assertionIndex: number;
      kind: string;
      text: string;
      sourceChunkIndex?: number | null | undefined;
      sourceSpanJson?: string | null | undefined;
      confidence?: number | null | undefined;
    }>
  ): Promise<void> {
    this.assertId(id);
    this.asset.assertions = assertions.map((assertion, index) => ({
      id: `assertion-${index + 1}`,
      assertionIndex: assertion.assertionIndex,
      kind: assertion.kind as NonNullable<
        AssetDetail["assertions"]
      >[number]["kind"],
      text: assertion.text,
      sourceChunkIndex: assertion.sourceChunkIndex ?? null,
      sourceSpanJson: assertion.sourceSpanJson ?? null,
      confidence: assertion.confidence ?? null,
      createdAt: "2026-03-19T00:01:00.000Z",
      updatedAt: "2026-03-19T00:01:00.000Z",
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

  public async updateAssetMetadata(
    id: string,
    input: {
      title?: string | undefined;
      summary?: string | null | undefined;
      sourceUrl?: string | null | undefined;
    }
  ): Promise<AssetDetail> {
    this.assertId(id);

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
    this.assertId(id);
  }

  public async restoreAsset(id: string): Promise<AssetDetail> {
    this.assertId(id);

    return structuredClone(this.asset);
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

class InMemoryWebPageFetcher implements WebPageFetcher {
  public constructor(
    private readonly fetchUrlResult: WebPageFetchResult | Error
  ) {}

  public async fetchUrl(_url: string): Promise<WebPageFetchResult> {
    if (this.fetchUrlResult instanceof Error) {
      throw this.fetchUrlResult;
    }

    return structuredClone(this.fetchUrlResult);
  }
}

class InMemoryWorkflowRepository implements WorkflowRepository {
  public readonly runs: WorkflowRunRecord[] = [];

  public readonly steps: WorkflowStepRecord[] = [];

  public readonly artifacts: AssetArtifactRecord[] = [];

  public async createWorkflowRun(
    input: CreateWorkflowRunInput
  ): Promise<{ id: string }> {
    const id = `run-${this.runs.length + 1}`;

    this.runs.push({
      id,
      assetId: input.assetId,
      workflowType: input.workflowType,
      triggerType: input.triggerType,
      status: "queued",
      stateJson: input.stateJson ?? null,
      currentStep: null,
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: "2026-03-19T00:00:00.000Z",
      updatedAt: "2026-03-19T00:00:00.000Z",
    });

    return { id };
  }

  public async getWorkflowRunById(runId: string): Promise<WorkflowRunRecord> {
    return structuredClone(this.getRun(runId));
  }

  public async listWorkflowRunsByAssetId(
    assetId: string
  ): Promise<WorkflowRunRecord[]> {
    return this.runs
      .filter((run) => run.assetId === assetId)
      .map((run) => structuredClone(run));
  }

  public async getWorkflowRunDetail(runId: string) {
    return {
      run: structuredClone(this.getRun(runId)),
      steps: this.steps
        .filter((step) => step.runId === runId)
        .map((step) => structuredClone(step)),
      artifacts: this.artifacts
        .filter((artifact) => artifact.createdByRunId === runId)
        .map((artifact) => structuredClone(artifact)),
    };
  }

  public async createWorkflowSteps(
    runId: string,
    steps: CreateWorkflowStepInput[]
  ): Promise<WorkflowStepRecord[]> {
    const created = steps.map((step, index) => ({
      id: `step-${this.steps.length + index + 1}`,
      runId,
      assetId: step.assetId,
      stepKey: step.stepKey,
      stepType: step.stepType,
      status: "pending" as const,
      attempt: 0,
      inputJson: step.inputJson ?? null,
      outputJson: null,
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: "2026-03-19T00:00:00.000Z",
      updatedAt: "2026-03-19T00:00:00.000Z",
    }));

    this.steps.push(...created);

    return created.map((step) => structuredClone(step));
  }

  public async listWorkflowStepsByRunId(
    runId: string
  ): Promise<WorkflowStepRecord[]> {
    return this.steps
      .filter((step) => step.runId === runId)
      .map((step) => structuredClone(step));
  }

  public async updateWorkflowRunState(
    runId: string,
    stateJson?: string | null
  ): Promise<void> {
    const run = this.getRun(runId);

    run.stateJson = stateJson ?? null;
    run.updatedAt = "2026-03-19T00:01:30.000Z";
  }

  public async markWorkflowRunRunning(
    runId: string,
    currentStep: string
  ): Promise<void> {
    const run = this.getRun(runId);

    run.status = "running";
    run.currentStep = currentStep;
    run.startedAt = "2026-03-19T00:01:00.000Z";
    run.updatedAt = "2026-03-19T00:01:00.000Z";
  }

  public async completeWorkflowRun(runId: string): Promise<void> {
    const run = this.getRun(runId);

    run.status = "succeeded";
    run.currentStep = null;
    run.finishedAt = "2026-03-19T00:02:00.000Z";
    run.updatedAt = "2026-03-19T00:02:00.000Z";
  }

  public async failWorkflowRun(
    runId: string,
    currentStep: string | null,
    message: string
  ): Promise<void> {
    const run = this.getRun(runId);

    run.status = "failed";
    run.currentStep = currentStep;
    run.errorMessage = message;
    run.finishedAt = "2026-03-19T00:03:00.000Z";
    run.updatedAt = "2026-03-19T00:03:00.000Z";
  }

  public async markWorkflowStepRunning(stepId: string): Promise<void> {
    const step = this.getStep(stepId);

    step.status = "running";
    step.attempt += 1;
    step.startedAt = "2026-03-19T00:01:00.000Z";
    step.updatedAt = "2026-03-19T00:01:00.000Z";
  }

  public async completeWorkflowStep(
    stepId: string,
    outputJson?: string | null
  ): Promise<void> {
    const step = this.getStep(stepId);

    step.status = "succeeded";
    step.outputJson = outputJson ?? null;
    step.finishedAt = "2026-03-19T00:02:00.000Z";
    step.updatedAt = "2026-03-19T00:02:00.000Z";
  }

  public async skipWorkflowStep(
    stepId: string,
    outputJson?: string | null
  ): Promise<void> {
    const step = this.getStep(stepId);

    step.status = "skipped";
    step.outputJson = outputJson ?? null;
    step.finishedAt = "2026-03-19T00:02:00.000Z";
    step.updatedAt = "2026-03-19T00:02:00.000Z";
  }

  public async failWorkflowStep(
    stepId: string,
    message: string,
    outputJson?: string | null
  ): Promise<void> {
    const step = this.getStep(stepId);

    step.status = "failed";
    step.outputJson = outputJson ?? null;
    step.errorMessage = message;
    step.finishedAt = "2026-03-19T00:03:00.000Z";
    step.updatedAt = "2026-03-19T00:03:00.000Z";
  }

  public async createAssetArtifact(
    input: CreateAssetArtifactInput
  ): Promise<void> {
    this.artifacts.push({
      id: `artifact-${this.artifacts.length + 1}`,
      assetId: input.assetId,
      artifactType: input.artifactType,
      version:
        this.artifacts.filter(
          (artifact) =>
            artifact.assetId === input.assetId &&
            artifact.artifactType === input.artifactType
        ).length + 1,
      storageKind: input.storageKind,
      r2Key: input.r2Key ?? null,
      contentText: input.contentText ?? null,
      metadataJson: input.metadataJson ?? null,
      createdByRunId: input.createdByRunId ?? null,
      createdAt: "2026-03-19T00:01:00.000Z",
    });
  }

  public async listAssetArtifactsByRunId(
    runId: string
  ): Promise<AssetArtifactRecord[]> {
    return this.artifacts
      .filter((artifact) => artifact.createdByRunId === runId)
      .map((artifact) => structuredClone(artifact));
  }

  private getRun(id: string): WorkflowRunRecord {
    const run = this.runs.find((item) => item.id === id);

    if (!run) {
      throw new Error(`Unexpected workflow run id "${id}".`);
    }

    return run;
  }

  private getStep(id: string): WorkflowStepRecord {
    const step = this.steps.find((item) => item.id === id);

    if (!step) {
      throw new Error(`Unexpected workflow step id "${id}".`);
    }

    return step;
  }
}

class InMemoryJobQueue implements JobQueue {
  public readonly messages: JobQueueMessage[] = [];

  public async enqueue(message: JobQueueMessage): Promise<void> {
    this.messages.push(structuredClone(message));
  }
}

const drainWorkflowQueue = async (
  jobQueue: InMemoryJobQueue,
  repository: InMemoryAssetRepository,
  workflowRepository: InMemoryWorkflowRepository,
  blobStore: InMemoryBlobStore,
  vectorStore: InMemoryVectorStore,
  aiProvider: InMemoryAIProvider,
  webPageFetcher?: WebPageFetcher
): Promise<void> => {
  while (jobQueue.messages.length > 0) {
    const message = jobQueue.messages.shift();

    if (!message) {
      return;
    }

    const payload = parseWorkflowStepQueuePayload(message);

    if (!payload) {
      throw new Error(`Unexpected queue message type "${message.type}".`);
    }

    const run = await workflowRepository.getWorkflowRunById(payload.runId);
    const definition = getWorkflowDefinition(run.workflowType);

    await consumeWorkflowStepMessage(definition, payload, {
      assetRepository: repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      webPageFetcher,
    });
  }
};

const getArtifactContent = (
  repository: InMemoryWorkflowRepository,
  artifactType: string
) => {
  const artifact = repository.artifacts.find(
    (item) => item.artifactType === artifactType
  );

  if (!artifact?.contentText) {
    throw new Error(`Artifact "${artifactType}" is missing content.`);
  }

  return JSON.parse(artifact.contentText) as Record<string, unknown>;
};

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
    const workflowRepository = new InMemoryWorkflowRepository();
    const jobQueue = new InMemoryJobQueue();

    const enqueued = await processTextAsset(
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      "asset-1"
    );

    expect(enqueued.status).toBe("processing");
    expect(enqueued.jobs[0]?.status).toBe("running");
    expect(jobQueue.messages).toHaveLength(1);

    await drainWorkflowQueue(
      jobQueue,
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider
    );

    const result = await repository.getAssetById("asset-1");

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
    expect(result.domain).toBe("general");
    expect(result.sensitivity).toBe("internal");
    expect(result.aiVisibility).toBe("allow");
    expect(result.retrievalPriority).toBe(10);
    expect(result.collectionKey).toBe("inbox:notes");
    expect(result.sourceKind).toBe("manual");
    expect(result.jobs[0]?.status).toBe("succeeded");
    expect(result.jobs[0]?.errorMessage).toBeNull();
    expect(
      vectorStore.upsertCalls.some((batch) =>
        batch.some((record) => record.id === "asset-1:0")
      )
    ).toBe(true);
    expect(workflowRepository.runs).toEqual([
      expect.objectContaining({
        assetId: "asset-1",
        workflowType: "note_ingest_v1",
        triggerType: "ingest",
        status: "succeeded",
      }),
    ]);
    expect(workflowRepository.steps.map((step) => step.stepKey)).toEqual([
      "clean_content",
      "summarize",
      "derive_descriptor",
      "derive_access_policy",
      "derive_facets",
      "derive_assertions",
      "persist_content",
      "chunk",
      "embed",
      "index",
      "finalize",
    ]);
    expect(
      workflowRepository.steps.every((step) => step.status === "succeeded")
    ).toBe(true);
    expect(workflowRepository.artifacts).toEqual([
      expect.objectContaining({
        artifactType: "summary",
        storageKind: "inline",
      }),
      expect.objectContaining({
        artifactType: "descriptor",
        storageKind: "inline",
      }),
      expect.objectContaining({
        artifactType: "access_policy",
        storageKind: "inline",
      }),
      expect.objectContaining({
        artifactType: "clean_content",
        storageKind: "r2",
        r2Key: "assets/asset-1/content/content.txt",
      }),
    ]);
    expect(getArtifactContent(workflowRepository, "descriptor")).toMatchObject({
      domain: "general",
      collectionKey: "inbox:notes",
      strategy: "heuristic_v2",
    });
    expect(
      getArtifactContent(workflowRepository, "access_policy")
    ).toMatchObject({
      sensitivity: "internal",
      aiVisibility: "allow",
      retrievalPriority: 10,
      strategy: "heuristic_v1",
    });
  });

  it("accepts validated enrichment for summary, descriptor, and facets", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        contentText:
          "CloudMind workflow notes about queues, search, and MCP context.",
      })
    );
    const blobStore = new InMemoryBlobStore();
    const vectorStore = new InMemoryVectorStore();
    const aiProvider = new InMemoryAIProvider();
    const workflowRepository = new InMemoryWorkflowRepository();
    const jobQueue = new InMemoryJobQueue();

    const enqueued = await processTextAsset(
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      "asset-1",
      {
        enrichment: {
          summary: "Client-authored summary for CloudMind workflow design.",
          domain: "engineering",
          documentClass: "design_doc",
          descriptor: {
            topics: ["workflow", "mcp", "search"],
            collectionKey: "project/cloudmind",
            signals: ["seeded_by_client", "manual_reviewed"],
          },
          facets: [
            {
              facetKey: "topic",
              facetValue: "workflow",
              facetLabel: "workflow",
              sortOrder: 10,
            },
            {
              facetKey: "collection",
              facetValue: "project/cloudmind",
              facetLabel: "project/cloudmind",
              sortOrder: 11,
            },
          ],
        },
      }
    );

    expect(enqueued.status).toBe("processing");

    await drainWorkflowQueue(
      jobQueue,
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider
    );

    const result = await repository.getAssetById("asset-1");
    const descriptor = getArtifactContent(workflowRepository, "descriptor");

    expect(result.summary).toBe(
      "Client-authored summary for CloudMind workflow design."
    );
    expect(result.domain).toBe("engineering");
    expect(result.documentClass).toBe("design_doc");
    expect(result.collectionKey).toBe("project/cloudmind");
    expect(result.facets).toEqual([
      expect.objectContaining({
        facetKey: "topic",
        facetValue: "workflow",
        sortOrder: 10,
      }),
      expect.objectContaining({
        facetKey: "collection",
        facetValue: "project/cloudmind",
        sortOrder: 11,
      }),
    ]);
    expect(descriptor).toMatchObject({
      domain: "engineering",
      documentClass: "design_doc",
      collectionKey: "project/cloudmind",
      topics: ["workflow", "mcp", "search"],
      signals: ["seeded_by_client", "manual_reviewed"],
    });
  });

  it("uses AI enrichment semantic hints first and keeps heuristic fallback", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        contentText:
          "TypeScript repository architecture with API design and queue workers.",
      })
    );
    const blobStore = new InMemoryBlobStore();
    const vectorStore = new InMemoryVectorStore();
    const aiProvider = new InMemoryAIProvider();
    const workflowRepository = new InMemoryWorkflowRepository();
    const jobQueue = new InMemoryJobQueue();

    const enqueued = await processTextAsset(
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      "asset-1",
      {
        enrichment: {
          descriptor: {
            topics: ["agent-memory"],
            tags: ["reuse-first"],
          },
        },
      }
    );

    expect(enqueued.status).toBe("processing");
    expect(jobQueue.messages).toHaveLength(1);

    await drainWorkflowQueue(
      jobQueue,
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider
    );

    const result = await repository.getAssetById("asset-1");
    const descriptor = getArtifactContent(workflowRepository, "descriptor");

    expect(result.status).toBe("ready");
    expect(result.domain).toBe("general");
    expect(result.documentClass).toBe("general_note");
    expect(descriptor).toMatchObject({
      domain: "general",
      documentClass: "general_note",
      topics: ["agent-memory"],
      tags: ["reuse-first"],
    });
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
    const workflowRepository = new InMemoryWorkflowRepository();
    const jobQueue = new InMemoryJobQueue();

    const enqueued = await processTextAsset(
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      "asset-1"
    );

    expect(enqueued.status).toBe("processing");
    expect(jobQueue.messages).toHaveLength(1);

    await expect(
      drainWorkflowQueue(
        jobQueue,
        repository,
        workflowRepository,
        blobStore,
        vectorStore,
        aiProvider
      )
    ).rejects.toThrow("Asset content is empty and cannot be processed.");

    const result = await repository.getAssetById("asset-1");

    expect(result.status).toBe("failed");
    expect(result.summary).toBeNull();
    expect(result.errorMessage).toBe(
      "Asset content is empty and cannot be processed."
    );
    expect(result.jobs[0]?.status).toBe("failed");
    expect(result.jobs[0]?.errorMessage).toBe(
      "Asset content is empty and cannot be processed."
    );
    expect(workflowRepository.runs[0]).toEqual(
      expect.objectContaining({
        status: "failed",
        currentStep: "clean_content",
      })
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
    const workflowRepository = new InMemoryWorkflowRepository();
    const jobQueue = new InMemoryJobQueue();

    const result = await processTextAsset(
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      "asset-1"
    );

    expect(result.status).toBe("ready");
    expect(result.summary).toBe("Existing summary");
    expect(result.jobs[0]?.status).toBe("succeeded");
    expect(workflowRepository.runs).toEqual([]);
    expect(jobQueue.messages).toEqual([]);
  });
});

describe("processUrlAsset", () => {
  it("fetches URL content, stores blobs, and promotes the asset to ready", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-url-1",
        type: "url",
        title: "Cloudflare Docs",
        contentText: null,
        sourceUrl: "https://developers.cloudflare.com",
      })
    );
    const blobStore = new InMemoryBlobStore();
    const vectorStore = new InMemoryVectorStore();
    const aiProvider = new InMemoryAIProvider();
    const webPageFetcher = new InMemoryWebPageFetcher({
      title: "Cloudflare Developers",
      sourceUrl: "https://developers.cloudflare.com/workers/",
      rawContent:
        "Title: Cloudflare Developers\n" +
        "URL Source: https://developers.cloudflare.com/workers/\n" +
        "Markdown Content:\n" +
        "Cloudflare Workers runtime guide for building APIs with D1 and R2.",
      content:
        "Cloudflare Workers runtime guide for building APIs with D1 and R2.",
      fetchedAt: "2026-03-19T00:00:30.000Z",
      provider: "jina_reader",
    });
    const workflowRepository = new InMemoryWorkflowRepository();

    const jobQueue = new InMemoryJobQueue();

    const enqueued = await processUrlAsset(
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      webPageFetcher,
      "asset-url-1"
    );

    expect(enqueued.status).toBe("processing");
    expect(jobQueue.messages).toHaveLength(1);

    await drainWorkflowQueue(
      jobQueue,
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      webPageFetcher
    );

    const result = await repository.getAssetById("asset-url-1");

    expect(result.status).toBe("ready");
    expect(result.summary).toBe(
      "Cloudflare Workers runtime guide for building APIs with D1 and R2."
    );
    expect(result.rawR2Key).toBe("assets/asset-url-1/raw/source.md");
    expect(result.contentR2Key).toBe("assets/asset-url-1/content/content.txt");
    expect(result.contentText).toBe(
      "Cloudflare Workers runtime guide for building APIs with D1 and R2."
    );
    expect(result.domain).toBe("engineering");
    expect(result.sensitivity).toBe("public");
    expect(result.aiVisibility).toBe("allow");
    expect(result.retrievalPriority).toBe(50);
    expect(result.collectionKey).toBe("site:developers.cloudflare.com");
    expect(result.sourceUrl).toBe("https://developers.cloudflare.com/workers/");
    expect(result.jobs[0]?.status).toBe("succeeded");
    expect(result.chunks).toEqual([
      {
        id: "chunk-1",
        chunkIndex: 0,
        textPreview:
          "Cloudflare Workers runtime guide for building APIs with D1 and R2.",
        contentText:
          "Cloudflare Workers runtime guide for building APIs with D1 and R2.",
        vectorId: "asset-url-1:0",
      },
    ]);
    expect(workflowRepository.runs).toEqual([
      expect.objectContaining({
        assetId: "asset-url-1",
        workflowType: "url_ingest_v1",
        triggerType: "ingest",
        status: "succeeded",
      }),
    ]);
    expect(workflowRepository.steps.map((step) => step.stepKey)).toEqual([
      "load_source",
      "clean_content",
      "summarize",
      "derive_descriptor",
      "derive_access_policy",
      "derive_facets",
      "derive_assertions",
      "persist_content",
      "chunk",
      "embed",
      "index",
      "finalize",
    ]);
    expect(workflowRepository.artifacts).toEqual([
      expect.objectContaining({
        artifactType: "summary",
        storageKind: "inline",
        contentText:
          "Cloudflare Workers runtime guide for building APIs with D1 and R2.",
      }),
      expect.objectContaining({
        artifactType: "descriptor",
        storageKind: "inline",
      }),
      expect.objectContaining({
        artifactType: "access_policy",
        storageKind: "inline",
      }),
      expect.objectContaining({
        artifactType: "clean_content",
        storageKind: "r2",
        r2Key: "assets/asset-url-1/content/content.txt",
      }),
    ]);
    expect(getArtifactContent(workflowRepository, "descriptor")).toMatchObject({
      domain: "engineering",
      collectionKey: "site:developers.cloudflare.com",
      sourceHost: "developers.cloudflare.com",
    });
    expect(
      getArtifactContent(workflowRepository, "access_policy")
    ).toMatchObject({
      sensitivity: "public",
      aiVisibility: "allow",
      retrievalPriority: 50,
    });
  });

  it("marks the asset as failed when the URL is empty", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-url-empty",
        type: "url",
        title: "Empty URL",
        contentText: null,
        sourceUrl: "   ",
      })
    );
    const blobStore = new InMemoryBlobStore();
    const vectorStore = new InMemoryVectorStore();
    const aiProvider = new InMemoryAIProvider();
    const webPageFetcher = new InMemoryWebPageFetcher(
      new Error("unused fetcher")
    );
    const workflowRepository = new InMemoryWorkflowRepository();

    const jobQueue = new InMemoryJobQueue();

    const enqueued = await processUrlAsset(
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      webPageFetcher,
      "asset-url-empty"
    );

    expect(enqueued.status).toBe("processing");
    expect(jobQueue.messages).toHaveLength(1);

    await expect(
      drainWorkflowQueue(
        jobQueue,
        repository,
        workflowRepository,
        blobStore,
        vectorStore,
        aiProvider
      )
    ).rejects.toThrow("Asset URL is empty and cannot be processed.");

    const result = await repository.getAssetById("asset-url-empty");

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe(
      "Asset URL is empty and cannot be processed."
    );
    expect(result.jobs[0]?.status).toBe("failed");
    expect(workflowRepository.runs[0]).toEqual(
      expect.objectContaining({
        workflowType: "url_ingest_v1",
        status: "failed",
        currentStep: "load_source",
      })
    );
  });

  it("marks the asset as failed when Jina Reader fetch fails", async () => {
    const repository = new InMemoryAssetRepository(
      createAsset({
        id: "asset-url-fetch-failed",
        type: "url",
        title: "Broken URL",
        contentText: null,
        sourceUrl: "https://example.com/broken",
      })
    );
    const blobStore = new InMemoryBlobStore();
    const vectorStore = new InMemoryVectorStore();
    const aiProvider = new InMemoryAIProvider();
    const webPageFetcher = new InMemoryWebPageFetcher(
      new Error("Jina Reader request failed with status 429.")
    );
    const workflowRepository = new InMemoryWorkflowRepository();
    const jobQueue = new InMemoryJobQueue();

    const enqueued = await processUrlAsset(
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      webPageFetcher,
      "asset-url-fetch-failed"
    );

    expect(enqueued.status).toBe("processing");

    await expect(
      drainWorkflowQueue(
        jobQueue,
        repository,
        workflowRepository,
        blobStore,
        vectorStore,
        aiProvider,
        webPageFetcher
      )
    ).rejects.toThrow("Jina Reader request failed with status 429.");

    const result = await repository.getAssetById("asset-url-fetch-failed");

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe(
      "Jina Reader request failed with status 429."
    );
    expect(result.jobs[0]?.status).toBe("failed");
    expect(workflowRepository.runs[0]).toEqual(
      expect.objectContaining({
        workflowType: "url_ingest_v1",
        status: "failed",
        currentStep: "load_source",
      })
    );
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
    const workflowRepository = new InMemoryWorkflowRepository();
    const jobQueue = new InMemoryJobQueue();

    const enqueued = await processPdfAsset(
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      "asset-pdf-1"
    );

    expect(enqueued.status).toBe("processing");
    expect(jobQueue.messages).toHaveLength(1);

    await drainWorkflowQueue(
      jobQueue,
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider
    );

    const result = await repository.getAssetById("asset-pdf-1");

    expect(result.status).toBe("ready");
    expect(result.summary).toBe("Hello CloudMind PDF");
    expect(result.contentText).toBe("Hello CloudMind PDF");
    expect(result.contentR2Key).toBe("assets/asset-pdf-1/content/content.txt");
    expect(result.domain).toBe("research");
    expect(result.sensitivity).toBe("internal");
    expect(result.aiVisibility).toBe("allow");
    expect(result.retrievalPriority).toBe(30);
    expect(result.collectionKey).toBe("library:pdf");
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
    expect(
      vectorStore.upsertCalls.some((batch) =>
        batch.some((record) => record.id === "asset-pdf-1:0")
      )
    ).toBe(true);
    expect(workflowRepository.runs).toEqual([
      expect.objectContaining({
        assetId: "asset-pdf-1",
        workflowType: "pdf_ingest_v1",
        triggerType: "ingest",
        status: "succeeded",
      }),
    ]);
    expect(workflowRepository.steps.map((step) => step.stepKey)).toEqual([
      "load_source",
      "clean_content",
      "summarize",
      "derive_descriptor",
      "derive_access_policy",
      "derive_facets",
      "derive_assertions",
      "persist_content",
      "chunk",
      "embed",
      "index",
      "finalize",
    ]);
    expect(
      workflowRepository.steps.every((step) => step.status === "succeeded")
    ).toBe(true);
    expect(workflowRepository.artifacts).toEqual([
      expect.objectContaining({
        artifactType: "summary",
        storageKind: "inline",
      }),
      expect.objectContaining({
        artifactType: "descriptor",
        storageKind: "inline",
      }),
      expect.objectContaining({
        artifactType: "access_policy",
        storageKind: "inline",
      }),
      expect.objectContaining({
        artifactType: "clean_content",
        storageKind: "r2",
        r2Key: "assets/asset-pdf-1/content/content.txt",
      }),
    ]);
    expect(getArtifactContent(workflowRepository, "descriptor")).toMatchObject({
      domain: "research",
      collectionKey: "library:pdf",
      strategy: "heuristic_v2",
    });
    expect(
      getArtifactContent(workflowRepository, "access_policy")
    ).toMatchObject({
      sensitivity: "internal",
      aiVisibility: "allow",
      retrievalPriority: 30,
    });
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
    const workflowRepository = new InMemoryWorkflowRepository();
    const jobQueue = new InMemoryJobQueue();

    const enqueued = await processPdfAsset(
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      "asset-pdf-missing"
    );

    expect(enqueued.status).toBe("processing");

    await expect(
      drainWorkflowQueue(
        jobQueue,
        repository,
        workflowRepository,
        blobStore,
        vectorStore,
        aiProvider
      )
    ).rejects.toThrow("Asset file was not found in blob storage.");

    const result = await repository.getAssetById("asset-pdf-missing");

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe(
      "Asset file was not found in blob storage."
    );
    expect(result.jobs[0]?.status).toBe("failed");
    expect(workflowRepository.runs[0]).toEqual(
      expect.objectContaining({
        workflowType: "pdf_ingest_v1",
        status: "failed",
        currentStep: "load_source",
      })
    );
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
    const workflowRepository = new InMemoryWorkflowRepository();
    const jobQueue = new InMemoryJobQueue();

    const enqueued = await processPdfAsset(
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      "asset-pdf-invalid"
    );

    expect(enqueued.status).toBe("processing");

    await expect(
      drainWorkflowQueue(
        jobQueue,
        repository,
        workflowRepository,
        blobStore,
        vectorStore,
        aiProvider
      )
    ).rejects.toThrow("Uploaded file is not a valid PDF.");

    const result = await repository.getAssetById("asset-pdf-invalid");

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("Uploaded file is not a valid PDF.");
    expect(result.jobs[0]?.status).toBe("failed");
    expect(workflowRepository.runs[0]).toEqual(
      expect.objectContaining({
        status: "failed",
        currentStep: "load_source",
      })
    );
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
    const workflowRepository = new InMemoryWorkflowRepository();
    const jobQueue = new InMemoryJobQueue();

    const enqueued = await processPdfAsset(
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      "asset-pdf-broken"
    );

    expect(enqueued.status).toBe("processing");

    await expect(
      drainWorkflowQueue(
        jobQueue,
        repository,
        workflowRepository,
        blobStore,
        vectorStore,
        aiProvider
      )
    ).rejects.toThrow("Failed to extract text from PDF.");

    const result = await repository.getAssetById("asset-pdf-broken");

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("Failed to extract text from PDF.");
    expect(result.jobs[0]?.status).toBe("failed");
    expect(workflowRepository.runs[0]).toEqual(
      expect.objectContaining({
        status: "failed",
        currentStep: "load_source",
      })
    );
  });
});
