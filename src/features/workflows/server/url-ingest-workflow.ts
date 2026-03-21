import type { AIProvider } from "@/core/ai/ports";
import type { AssetIngestRepository } from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
import type { JobQueue } from "@/core/queue/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { WorkflowRepository } from "@/core/workflows/ports";
import type { AssetDetail } from "@/features/assets/model/types";

import {
  type AssetDescriptor,
  deriveAccessPolicy,
  deriveDescriptor,
} from "./indexing-policy";
import { enqueueWorkflow, type WorkflowDefinition } from "./runtime";

export const createUrlIngestWorkflowDefinition = (): WorkflowDefinition => {
  return {
    type: "url_ingest_v1",
    steps: [
      {
        key: "load_source",
        type: "load_source",
        execute: (context) => {
          const sourceUrl = context.asset.sourceUrl?.trim();

          if (!sourceUrl) {
            throw new Error("Asset URL is empty and cannot be processed.");
          }

          return {
            output: {
              sourceUrl,
            },
            state: {
              sourceUrl,
            },
          };
        },
      },
      {
        key: "summarize",
        type: "summarize",
        execute: (context) => {
          const sourceUrl = context.state.sourceUrl;

          if (typeof sourceUrl !== "string") {
            throw new Error("Workflow state is missing source URL.");
          }

          const summary = `Saved URL asset for ${sourceUrl}`;

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
                  sourceUrl,
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
          const derived = deriveDescriptor({
            asset: context.asset,
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

          if (!descriptor || typeof descriptor !== "object") {
            throw new Error("Workflow state is missing descriptor.");
          }

          const derived = deriveAccessPolicy(
            {
              asset: context.asset,
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
        key: "finalize",
        type: "finalize",
        execute: async (context) => {
          const summary = context.state.summary;

          if (typeof summary !== "string") {
            throw new Error("Workflow state is missing summary.");
          }

          await context.services.assetRepository.completeAssetProcessing(
            context.asset.id,
            {
              summary,
            }
          );
          await context.services.assetRepository.replaceAssetChunks(
            context.asset.id,
            []
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

// 这里启动 URL workflow，但真正 step 执行交给 Queue consumer。
export const runUrlIngestWorkflow = async (
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
    },
    options
  );
};
