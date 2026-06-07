import { describe, expect, it, vi } from "vitest";

import type { AIProvider } from "@/core/ai/ports";
import type { AssetIngestRepository } from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
import type { JobQueue } from "@/core/queue/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { WorkflowRepository } from "@/core/workflows/ports";
import type { AssetDetail } from "@/features/assets/model/types";
import type {
  WorkflowExecutionContext,
  WorkflowServices,
} from "@/features/workflows/server/runtime";
import {
  createEmbedStep,
  createFinalizeStep,
} from "@/features/workflows/server/shared-workflow-steps";

const createAsset = (): AssetDetail => {
  return {
    id: "asset-1",
    type: "note",
    title: "Workflow state asset",
    summary: null,
    sourceUrl: null,
    sourceKind: "manual",
    status: "processing",
    domain: "general",
    aiVisibility: "allow",
    retrievalPriority: 0,
    sourceHost: null,
    collectionKey: "inbox:notes",
    capturedAt: "2026-03-20T00:00:00.000Z",
    createdAt: "2026-03-20T00:00:00.000Z",
    updatedAt: "2026-03-20T00:00:00.000Z",
    contentText: null,
    rawR2Key: null,
    contentR2Key: null,
    mimeType: "text/plain",
    language: null,
    errorMessage: null,
    processedAt: null,
    failedAt: null,
    source: null,
    jobs: [],
    chunks: [],
  };
};

const createServices = (): WorkflowServices => {
  return {
    assetRepository: {
      completeAssetProcessing: vi.fn(),
      replaceAssetChunks: vi.fn(),
    } as unknown as AssetIngestRepository,
    workflowRepository: {} as WorkflowRepository,
    blobStore: {} as BlobStore,
    vectorStore: {} as VectorStore,
    aiProvider: {
      createEmbeddings: vi.fn(async () => ({
        embeddings: [[0.1, 0.2]],
      })),
      generateText: vi.fn(),
    } as AIProvider,
    jobQueue: {} as JobQueue,
  };
};

const createContext = (
  state: Record<string, unknown>
): WorkflowExecutionContext => {
  return {
    asset: createAsset(),
    runId: "run-1",
    state,
    services: createServices(),
  };
};

describe("shared workflow steps", () => {
  it("rejects malformed persisted chunks before embedding", async () => {
    const step = createEmbedStep();
    const context = createContext({
      persistedContent: {
        contentText: "Stored preview",
        contentR2Key: "assets/asset-1/content.txt",
        chunks: [
          {
            chunkIndex: 0,
            textPreview: "Missing text",
          },
        ],
      },
    });

    await expect(step.execute(context)).rejects.toThrow(
      'Workflow state field "persistedContent" is invalid.'
    );
    expect(context.services.aiProvider.createEmbeddings).not.toHaveBeenCalled();
  });

  it("rejects malformed indexed chunks before finalizing", async () => {
    const step = createFinalizeStep();
    const context = createContext({
      summary: "Ready summary",
      persistedContent: {
        contentText: "Stored preview",
        contentR2Key: "assets/asset-1/content.txt",
        chunks: [
          {
            chunkIndex: 0,
            text: "Chunk text",
            textPreview: "Chunk text",
            contentHash: "hash",
          },
        ],
      },
      indexedChunks: [
        {
          chunkIndex: 0,
          textPreview: "Chunk text",
        },
      ],
    });

    await expect(step.execute(context)).rejects.toThrow(
      'Workflow state field "indexedChunks" is invalid.'
    );
    expect(
      context.services.assetRepository.completeAssetProcessing
    ).not.toHaveBeenCalled();
    expect(
      context.services.assetRepository.replaceAssetChunks
    ).not.toHaveBeenCalled();
  });
});
