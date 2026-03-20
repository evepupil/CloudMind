import type { AIProvider } from "@/core/ai/ports";
import type {
  AssetIngestRepository,
  CreateAssetChunkInput,
} from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { WorkflowRepository } from "@/core/workflows/ports";
import type { AssetDetail } from "@/features/assets/model/types";
import {
  createChunkEmbeddings,
  createTextSummary,
  indexPreparedChunks,
  normalizeContent,
  type PreparedChunk,
  persistProcessedContent,
} from "@/features/ingest/server/content-processing";

import { runWorkflow } from "./runtime";

const getLatestJob = (asset: AssetDetail) => {
  return asset.jobs[0] ?? null;
};

const getNormalizedContent = (asset: AssetDetail): string => {
  const content = asset.contentText?.trim();

  if (!content) {
    throw new Error("Asset content is empty and cannot be processed.");
  }

  return normalizeContent(content);
};

// 这里定义第一条真正落地的 workflow：note_ingest_v1。
export const runNoteIngestWorkflow = async (
  assetRepository: AssetIngestRepository,
  workflowRepository: WorkflowRepository,
  blobStore: BlobStore,
  vectorStore: VectorStore,
  aiProvider: AIProvider,
  assetId: string,
  triggerType: "ingest" | "reprocess",
  options?: {
    force?: boolean;
  }
): Promise<AssetDetail> => {
  const asset = await assetRepository.getAssetById(assetId);
  const latestJob = getLatestJob(asset);

  if (
    !options?.force &&
    (asset.status === "ready" || asset.status === "failed")
  ) {
    return asset;
  }

  try {
    await assetRepository.markAssetProcessing(asset.id);

    if (latestJob) {
      await assetRepository.markIngestJobRunning(latestJob.id);
    }

    await runWorkflow(
      {
        type: "note_ingest_v1",
        steps: [
          {
            key: "clean_content",
            type: "clean_content",
            execute: (context) => {
              const normalizedContent = getNormalizedContent(context.asset);

              return {
                output: {
                  contentLength: normalizedContent.length,
                },
                state: {
                  normalizedContent,
                },
              };
            },
          },
          {
            key: "summarize",
            type: "summarize",
            execute: (context) => {
              const normalizedContent = context.state.normalizedContent;

              if (typeof normalizedContent !== "string") {
                throw new Error(
                  "Workflow state is missing normalized content."
                );
              }

              const summary = createTextSummary(normalizedContent);

              return {
                output: {
                  summaryLength: summary.length,
                },
                state: {
                  summary,
                },
                artifacts: [
                  {
                    artifactType: "summary",
                    storageKind: "inline",
                    contentText: summary,
                    metadataJson: JSON.stringify({
                      workflowType: "note_ingest_v1",
                    }),
                  },
                ],
              };
            },
          },
          {
            key: "persist_content",
            type: "persist_content",
            execute: async (context) => {
              const normalizedContent = context.state.normalizedContent;

              if (typeof normalizedContent !== "string") {
                throw new Error(
                  "Workflow state is missing normalized content."
                );
              }

              const persistedContent = await persistProcessedContent(
                context.services.blobStore,
                context.asset.id,
                normalizedContent
              );

              return {
                output: {
                  chunkCount: persistedContent.chunks.length,
                },
                state: {
                  persistedContent,
                },
                artifacts: [
                  {
                    artifactType: "clean_content",
                    storageKind: "r2",
                    r2Key: persistedContent.contentR2Key,
                    metadataJson: JSON.stringify({
                      preview: persistedContent.contentText,
                      chunkCount: persistedContent.chunks.length,
                    }),
                  },
                ],
              };
            },
          },
          {
            key: "chunk",
            type: "chunk",
            execute: (context) => {
              const persistedContent = context.state.persistedContent;

              if (
                !persistedContent ||
                typeof persistedContent !== "object" ||
                !("chunks" in persistedContent) ||
                !Array.isArray(persistedContent.chunks)
              ) {
                throw new Error("Workflow state is missing persisted content.");
              }

              return {
                output: {
                  chunkCount: persistedContent.chunks.length,
                },
              };
            },
          },
          {
            key: "embed",
            type: "embed",
            execute: async (context) => {
              const persistedContent = context.state.persistedContent;

              if (
                !persistedContent ||
                typeof persistedContent !== "object" ||
                !("chunks" in persistedContent) ||
                !Array.isArray(persistedContent.chunks)
              ) {
                throw new Error("Workflow state is missing persisted content.");
              }

              const embeddings = await createChunkEmbeddings(
                context.services.aiProvider,
                persistedContent.chunks as PreparedChunk[]
              );

              return {
                output: {
                  embeddingCount: embeddings.length,
                  dimensions: embeddings[0]?.length ?? 0,
                },
                state: {
                  embeddings,
                },
              };
            },
          },
          {
            key: "index",
            type: "index",
            execute: async (context) => {
              const persistedContent = context.state.persistedContent;
              const embeddings = context.state.embeddings;

              if (
                !persistedContent ||
                typeof persistedContent !== "object" ||
                !("chunks" in persistedContent) ||
                !Array.isArray(persistedContent.chunks)
              ) {
                throw new Error("Workflow state is missing persisted content.");
              }

              if (!Array.isArray(embeddings)) {
                throw new Error("Workflow state is missing embeddings.");
              }

              const indexedChunks = await indexPreparedChunks(
                context.services.vectorStore,
                context.asset,
                persistedContent.chunks as PreparedChunk[],
                embeddings as number[][]
              );

              return {
                output: {
                  indexedChunkCount: indexedChunks.length,
                },
                state: {
                  indexedChunks,
                },
              };
            },
          },
          {
            key: "finalize",
            type: "finalize",
            execute: async (context) => {
              const summary = context.state.summary;
              const persistedContent = context.state.persistedContent;
              const indexedChunks = context.state.indexedChunks;

              if (typeof summary !== "string") {
                throw new Error("Workflow state is missing summary.");
              }

              if (
                !persistedContent ||
                typeof persistedContent !== "object" ||
                !("contentText" in persistedContent) ||
                !("contentR2Key" in persistedContent)
              ) {
                throw new Error("Workflow state is missing persisted content.");
              }

              await context.services.assetRepository.completeAssetProcessing(
                context.asset.id,
                {
                  summary,
                  contentText:
                    typeof persistedContent.contentText === "string"
                      ? persistedContent.contentText
                      : null,
                  contentR2Key:
                    typeof persistedContent.contentR2Key === "string"
                      ? persistedContent.contentR2Key
                      : null,
                }
              );
              await context.services.assetRepository.replaceAssetChunks(
                context.asset.id,
                Array.isArray(indexedChunks)
                  ? (indexedChunks as CreateAssetChunkInput[])
                  : []
              );

              return {
                output: {
                  finalized: true,
                },
              };
            },
          },
        ],
      },
      asset,
      triggerType,
      {
        assetRepository,
        workflowRepository,
        blobStore,
        vectorStore,
        aiProvider,
      }
    );

    if (latestJob) {
      await assetRepository.completeIngestJob(latestJob.id);
    }

    return assetRepository.getAssetById(asset.id);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown note ingest workflow error.";

    await assetRepository.failAssetProcessing(asset.id, message);

    if (latestJob) {
      await assetRepository.failIngestJob(latestJob.id, message);
    }

    return assetRepository.getAssetById(asset.id);
  }
};
