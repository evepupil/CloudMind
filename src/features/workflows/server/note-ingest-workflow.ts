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
  type TextAssetEnrichmentInput,
  textAssetEnrichmentSchema,
} from "@/features/ingest/model/enrichment";
import {
  createChunkEmbeddings,
  createTextSummary,
  indexPreparedChunks,
  normalizeContent,
  type PreparedChunk,
  persistProcessedContent,
} from "@/features/ingest/server/content-processing";

import {
  type AssetAccessPolicy,
  type AssetDescriptor,
  deriveAccessPolicy,
  deriveAssertions,
  deriveDescriptor,
  deriveFacets,
} from "./indexing-policy";
import { enqueueWorkflow, type WorkflowDefinition } from "./runtime";

const getNormalizedContent = (asset: AssetDetail): string => {
  const content = asset.contentText?.trim();

  if (!content) {
    throw new Error("Asset content is empty and cannot be processed.");
  }

  return normalizeContent(content);
};

const getTextAssetEnrichment = (
  state: Record<string, unknown>
): TextAssetEnrichmentInput | null => {
  const parsed = textAssetEnrichmentSchema.safeParse(state.enrichment);

  return parsed.success ? parsed.data : null;
};

const normalizeUniqueStrings = (values: string[] | undefined): string[] => {
  if (!values?.length) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
};

const mergeDescriptorWithEnrichment = (
  descriptor: AssetDescriptor,
  enrichment: TextAssetEnrichmentInput | null
): AssetDescriptor => {
  if (!enrichment) {
    return descriptor;
  }

  const topics = normalizeUniqueStrings(enrichment.descriptor?.topics);
  const signals = normalizeUniqueStrings(enrichment.descriptor?.signals);

  return {
    ...descriptor,
    domain: enrichment.domain ?? descriptor.domain,
    documentClass: enrichment.documentClass ?? descriptor.documentClass,
    topics: topics.length > 0 ? topics : descriptor.topics,
    collectionKey:
      enrichment.descriptor?.collectionKey ?? descriptor.collectionKey,
    signals: signals.length > 0 ? signals : descriptor.signals,
  };
};

export const createNoteIngestWorkflowDefinition = (): WorkflowDefinition => {
  return {
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
          const enrichment = getTextAssetEnrichment(context.state);

          if (typeof normalizedContent !== "string") {
            throw new Error("Workflow state is missing normalized content.");
          }

          const summary =
            enrichment?.summary ?? createTextSummary(normalizedContent);

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
        key: "derive_descriptor",
        type: "derive_descriptor",
        execute: async (context) => {
          const summary = context.state.summary;
          const normalizedContent = context.state.normalizedContent;
          const enrichment = getTextAssetEnrichment(context.state);

          const derived = deriveDescriptor({
            asset: context.asset,
            normalizedContent:
              typeof normalizedContent === "string" ? normalizedContent : null,
            summary: typeof summary === "string" ? summary : null,
          });
          const descriptor = mergeDescriptorWithEnrichment(
            derived.descriptor,
            enrichment
          );

          await context.services.assetRepository.updateAssetIndexing(
            context.asset.id,
            {
              sourceKind: descriptor.sourceKind,
              domain: descriptor.domain,
              documentClass: descriptor.documentClass,
              sourceHost: descriptor.sourceHost,
              collectionKey: descriptor.collectionKey,
              capturedAt: descriptor.capturedAt,
              descriptorJson: JSON.stringify(descriptor),
            }
          );

          return {
            output: {
              domain: descriptor.domain,
              collectionKey: descriptor.collectionKey,
            },
            state: {
              descriptor,
            },
            artifacts: [
              {
                artifactType: "descriptor",
                storageKind: "inline",
                contentText: JSON.stringify(descriptor),
                metadataJson: JSON.stringify({
                  strategy: descriptor.strategy,
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
        key: "derive_facets",
        type: "derive_facets",
        execute: async (context) => {
          const descriptor = context.state.descriptor;
          const accessPolicy = context.state.accessPolicy;
          const enrichment = getTextAssetEnrichment(context.state);

          if (!descriptor || typeof descriptor !== "object") {
            throw new Error("Workflow state is missing descriptor.");
          }

          if (!accessPolicy || typeof accessPolicy !== "object") {
            throw new Error("Workflow state is missing access policy.");
          }

          const facets =
            enrichment?.facets && enrichment.facets.length > 0
              ? enrichment.facets.map((facet, index) => ({
                  facetKey: facet.facetKey,
                  facetValue: facet.facetValue,
                  facetLabel: facet.facetLabel,
                  sortOrder: facet.sortOrder ?? index,
                }))
              : deriveFacets(
                  descriptor as AssetDescriptor,
                  accessPolicy as AssetAccessPolicy
                );

          await context.services.assetRepository.replaceAssetFacets?.(
            context.asset.id,
            facets
          );

          return {
            output: {
              facetCount: facets.length,
            },
          };
        },
      },
      {
        key: "derive_assertions",
        type: "derive_assertions",
        execute: async (context) => {
          const normalizedContent = context.state.normalizedContent;
          const summary = context.state.summary;
          const assertions = deriveAssertions({
            asset: context.asset,
            normalizedContent:
              typeof normalizedContent === "string" ? normalizedContent : null,
            summary: typeof summary === "string" ? summary : null,
          });

          await context.services.assetRepository.replaceAssetAssertions?.(
            context.asset.id,
            assertions
          );

          return {
            output: {
              assertionCount: assertions.length,
            },
          };
        },
      },
      {
        key: "persist_content",
        type: "persist_content",
        execute: async (context) => {
          const normalizedContent = context.state.normalizedContent;

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

// 这里启动 note workflow，但真正 step 执行交给 Queue consumer。
export const runNoteIngestWorkflow = async (
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
    enrichment?: TextAssetEnrichmentInput;
  }
): Promise<AssetDetail> => {
  return enqueueWorkflow(
    createNoteIngestWorkflowDefinition(),
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
    options,
    options?.enrichment
      ? {
          enrichment: options.enrichment,
        }
      : undefined
  );
};
