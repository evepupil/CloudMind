import type { AIProvider } from "@/core/ai/ports";
import type {
  AssetIngestRepository,
  CreateAssetChunkInput,
} from "@/core/assets/ports";
import { createRawAssetBlobKey } from "@/core/blob/keys";
import type { BlobStore } from "@/core/blob/ports";
import type { JobQueue } from "@/core/queue/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { WebPageFetcher } from "@/core/web/ports";
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

import {
  type AssetAccessPolicy,
  type AssetDescriptor,
  deriveAccessPolicy,
  deriveAssertions,
  deriveDescriptor,
  deriveFacets,
} from "./indexing-policy";
import { enqueueWorkflow, type WorkflowDefinition } from "./runtime";

const getWebPageFetcher = (context: {
  services: {
    webPageFetcher?: WebPageFetcher | undefined;
  };
}): WebPageFetcher => {
  if (!context.services.webPageFetcher) {
    throw new Error("Web page fetcher is not configured.");
  }

  return context.services.webPageFetcher;
};

const getRefinedAssetTitle = (
  asset: AssetDetail,
  fetchedTitle: string | null
): string | null => {
  const normalizedFetchedTitle = fetchedTitle?.trim();

  if (!normalizedFetchedTitle) {
    return null;
  }

  const currentTitle = asset.title.trim();
  const sourceUrl = asset.sourceUrl?.trim();

  if (!currentTitle || (sourceUrl && currentTitle === sourceUrl)) {
    return normalizedFetchedTitle;
  }

  return null;
};

export const createUrlIngestWorkflowDefinition = (): WorkflowDefinition => {
  return {
    type: "url_ingest_v1",
    steps: [
      {
        key: "load_source",
        type: "load_source",
        execute: async (context) => {
          const sourceUrl = context.asset.sourceUrl?.trim();

          if (!sourceUrl) {
            throw new Error("Asset URL is empty and cannot be processed.");
          }

          const fetchedPage = await getWebPageFetcher(context).fetchUrl(
            sourceUrl
          );
          const rawR2Key = createRawAssetBlobKey(context.asset.id, "source.md");

          await context.services.blobStore.put({
            key: rawR2Key,
            body: new TextEncoder()
              .encode(fetchedPage.rawContent)
              .buffer.slice(0) as ArrayBuffer,
            contentType: "text/markdown; charset=utf-8",
          });

          return {
            output: {
              sourceUrl: fetchedPage.sourceUrl,
              rawR2Key,
              provider: fetchedPage.provider,
              fetchedLength: fetchedPage.content.length,
            },
            state: {
              sourceUrl: fetchedPage.sourceUrl,
              fetchedTitle: fetchedPage.title,
              fetchedAt: fetchedPage.fetchedAt,
              rawR2Key,
              extractedContent: fetchedPage.content,
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
            throw new Error("Workflow state is missing fetched content.");
          }

          const normalizedContent = normalizeContent(extractedContent);

          if (!normalizedContent) {
            throw new Error("Fetched page content is empty after cleaning.");
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
                  workflowType: "url_ingest_v1",
                  sourceUrl: context.state.sourceUrl,
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
        key: "derive_facets",
        type: "derive_facets",
        execute: async (context) => {
          const descriptor = context.state.descriptor;
          const accessPolicy = context.state.accessPolicy;

          if (!descriptor || typeof descriptor !== "object") {
            throw new Error("Workflow state is missing descriptor.");
          }

          if (!accessPolicy || typeof accessPolicy !== "object") {
            throw new Error("Workflow state is missing access policy.");
          }

          const facets = deriveFacets(
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
          const sourceUrl = context.state.sourceUrl;
          const fetchedAt = context.state.fetchedAt;

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
                  sourceUrl:
                    typeof sourceUrl === "string" ? sourceUrl : null,
                  fetchedAt:
                    typeof fetchedAt === "string" ? fetchedAt : null,
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
          const rawR2Key = context.state.rawR2Key;
          const sourceUrl = context.state.sourceUrl;
          const refinedTitle = getRefinedAssetTitle(
            context.asset,
            typeof context.state.fetchedTitle === "string"
              ? context.state.fetchedTitle
              : null
          );

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
              rawR2Key: typeof rawR2Key === "string" ? rawR2Key : null,
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

          if (refinedTitle || typeof sourceUrl === "string") {
            await context.services.assetRepository.updateAssetMetadata(
              context.asset.id,
              {
                title: refinedTitle ?? undefined,
                sourceUrl:
                  typeof sourceUrl === "string" ? sourceUrl : undefined,
              }
            );
          }

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

// 这里启动 URL workflow，并把网页抓取能力作为独立适配器注入。
export const runUrlIngestWorkflow = async (
  assetRepository: AssetIngestRepository,
  workflowRepository: WorkflowRepository,
  blobStore: BlobStore,
  vectorStore: VectorStore,
  aiProvider: AIProvider,
  jobQueue: JobQueue,
  webPageFetcher: WebPageFetcher,
  assetId: string,
  triggerType: "ingest" | "reprocess",
  options?: {
    force?: boolean;
  }
): Promise<AssetDetail> => {
  return enqueueWorkflow(
    createUrlIngestWorkflowDefinition(),
    assetId,
    triggerType,
    {
      assetRepository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      webPageFetcher,
    },
    options
  );
};
