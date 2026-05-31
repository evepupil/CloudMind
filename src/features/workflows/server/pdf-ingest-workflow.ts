import type { AIProvider } from "@/core/ai/ports";
import type { AssetIngestRepository } from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
import type { JobQueue } from "@/core/queue/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { WorkflowRepository } from "@/core/workflows/ports";
import type { AssetDetail } from "@/features/assets/model/types";
import { generateWorkflowDescriptorEnrichment } from "@/features/ingest/server/auto-enrichment";
import { extractPdfText } from "@/features/ingest/server/pdf-extractor";
import { enqueueWorkflow, type WorkflowDefinition } from "./runtime";
import { buildSharedIngestSteps } from "./shared-workflow-steps";

const decodePdfSignature = (body: ArrayBuffer): string => {
  const signatureBytes = body.slice(0, 4);

  return new TextDecoder().decode(signatureBytes);
};

export const createPdfIngestWorkflowDefinition = (): WorkflowDefinition => ({
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
    ...buildSharedIngestSteps({
      cleanContent: {
        getContent: (_asset, state) => {
          const content = state.extractedContent;

          if (typeof content !== "string") {
            throw new Error("Workflow state is missing extracted content.");
          }

          return content;
        },
      },
      deriveDescriptor: {
        createEnrichment: async (context) => {
          const content = context.state.normalizedContent;
          const summary = context.state.summary;

          if (typeof content !== "string") {
            return undefined;
          }

          return generateWorkflowDescriptorEnrichment(
            context.services.aiProvider,
            context.services.vectorStore,
            {
              title: context.asset.title,
              content,
              summary: typeof summary === "string" ? summary : undefined,
              sourceKind: context.asset.sourceKind ?? undefined,
            }
          );
        },
      },
      persistContent: {
        buildExtraMetadata: (state) => ({
          totalPages:
            typeof state.totalPages === "number" ? state.totalPages : null,
        }),
      },
      finalize: {
        getRawR2Key: () => null, // rawR2Key is set from load_source context.asset.rawR2Key, not state
      },
    }),
  ],
});

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
