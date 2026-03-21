import type { AIProvider } from "@/core/ai/ports";
import type {
  AssetIngestRepository,
  CreateAssetChunkInput,
} from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
import type { JobQueue } from "@/core/queue/ports";
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
import { extractPdfText } from "@/features/ingest/server/pdf-extractor";

import {
  type AssetDescriptor,
  deriveAccessPolicy,
  deriveDescriptor,
} from "./indexing-policy";
import { enqueueWorkflow, type WorkflowDefinition } from "./runtime";

const decodePdfSignature = (body: ArrayBuffer): string => {
  const signatureBytes = body.slice(0, 4);

  return new TextDecoder().decode(signatureBytes);
};

export const createPdfIngestWorkflowDefinition = (): WorkflowDefinition => {
  return {
    type: "pdf_ingest_v1",
    steps: [
      {
        key: "load_source",
        type: "load_source",
        execute: async (context) => {
          const rawR2Key = context.asset.rawR2Key?.trim();

          if (!rawR2Key) {
            throw new Error("Asset raw file key is missing.");
          }

          const object = await context.services.blobStore.get(rawR2Key);

          if (!object) {
            throw new Error("Asset file was not found in blob storage.");
          }

          if (object.size === 0) {
            throw new Error("Asset file is empty and cannot be processed.");
          }

          if (decodePdfSignature(object.body) !== "%PDF") {
            throw new Error("Uploaded file is not a valid PDF.");
          }

          let extractedText: Awaited<ReturnType<typeof extractPdfText>>;

          try {
            extractedText = await extractPdfText(object.body);
          } catch {
            throw new Error("Failed to extract text from PDF.");
          }

          if (!extractedText.text) {
            throw new Error("No extractable text was found in the PDF.");
          }

          return {
            output: {
              rawR2Key,
              totalPages: extractedText.totalPages,
              extractedLength: extractedText.text.length,
            },
            state: {
              extractedContent: extractedText.text,
              totalPages: extractedText.totalPages,
            },
          };
        },
      },
      {
        key: "clean_content",
        type: "clean_content",
        execute: (context) => {
          const extractedContent = context.state.extractedContent;

          if (typeof extractedContent !== "string") {
            throw new Error("Workflow state is missing extracted content.");
          }

          const normalizedContent = normalizeContent(extractedContent);

          if (!normalizedContent) {
            throw new Error("No extractable text was found in the PDF.");
          }

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
            throw new Error("Workflow state is missing normalized content.");
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
                  workflowType: "pdf_ingest_v1",
                }),
              },
            ],
          };
        },
      },
      {
        key: "derive_descriptor",
        type: "derive_descriptor",
        execute: async (context) => {
          const summary = context.state.summary;
          const normalizedContent = context.state.normalizedContent;
          const derived = deriveDescriptor({
            asset: context.asset,
            normalizedContent:
              typeof normalizedContent === "string" ? normalizedContent : null,
            summary: typeof summary === "string" ? summary : null,
          });

          await context.services.assetRepository.updateAssetIndexing(
            context.asset.id,
            derived.indexing
          );

          return {
            output: {
              domain: derived.descriptor.domain,
              collectionKey: derived.descriptor.collectionKey,
            },
            state: {
              descriptor: derived.descriptor,
            },
            artifacts: [
              {
                artifactType: "descriptor",
                storageKind: "inline",
                contentText: JSON.stringify(derived.descriptor),
                metadataJson: JSON.stringify({
                  strategy: derived.descriptor.strategy,
                }),
              },
            ],
          };
        },
      },
      {
        key: "derive_access_policy",
        type: "derive_access_policy",
        execute: async (context) => {
          const descriptor = context.state.descriptor;
          const summary = context.state.summary;
          const normalizedContent = context.state.normalizedContent;

          if (!descriptor || typeof descriptor !== "object") {
            throw new Error("Workflow state is missing descriptor.");
          }

          const derived = deriveAccessPolicy(
            {
              asset: context.asset,
              normalizedContent:
                typeof normalizedContent === "string"
                  ? normalizedContent
                  : null,
              summary: typeof summary === "string" ? summary : null,
            },
            descriptor as AssetDescriptor
          );

          await context.services.assetRepository.updateAssetIndexing(
            context.asset.id,
            derived.indexing
          );

          return {
            output: {
              sensitivity: derived.policy.sensitivity,
              aiVisibility: derived.policy.aiVisibility,
              retrievalPriority: derived.policy.retrievalPriority,
            },
            state: {
              accessPolicy: derived.policy,
            },
            artifacts: [
              {
                artifactType: "access_policy",
                storageKind: "inline",
                contentText: JSON.stringify(derived.policy),
                metadataJson: JSON.stringify({
                  strategy: derived.policy.strategy,
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
          const totalPages = context.state.totalPages;

          if (typeof normalizedContent !== "string") {
            throw new Error("Workflow state is missing normalized content.");
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
                  totalPages:
                    typeof totalPages === "number" ? totalPages : null,
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
  };
};

// 这里启动 PDF workflow，但真正 step 执行交给 Queue consumer。
export const runPdfIngestWorkflow = async (
  assetRepository: AssetIngestRepository,
  workflowRepository: WorkflowRepository,
  blobStore: BlobStore,
  vectorStore: VectorStore,
  aiProvider: AIProvider,
  jobQueue: JobQueue,
  assetId: string,
  triggerType: "ingest" | "reprocess",
  options?: {
    force?: boolean;
  }
): Promise<AssetDetail> => {
  return enqueueWorkflow(
    createPdfIngestWorkflowDefinition(),
    assetId,
    triggerType,
    {
      assetRepository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
    },
    options
  );
};
