import type { AIProvider } from "@/core/ai/ports";
import type { AssetIngestRepository } from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
import type { JobQueue } from "@/core/queue/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { WorkflowRepository } from "@/core/workflows/ports";
import type { AssetDetail } from "@/features/assets/model/types";
import {
  type TextAssetEnrichmentInput,
  textAssetEnrichmentSchema,
} from "@/features/ingest/model/enrichment";
import { enqueueWorkflow, type WorkflowDefinition } from "./runtime";
import { buildSharedIngestSteps } from "./shared-workflow-steps";

const getTextAssetEnrichment = (
  state: Record<string, unknown>
): TextAssetEnrichmentInput | null => {
  const parsed = textAssetEnrichmentSchema.safeParse(state.enrichment);

  return parsed.success ? parsed.data : null;
};

export const createNoteIngestWorkflowDefinition = (): WorkflowDefinition => ({
  type: "note_ingest_v1",
  steps: buildSharedIngestSteps({
    cleanContent: {
      getContent: (asset) => {
        const content = asset.contentText?.trim();

        if (!content) {
          throw new Error("Asset content is empty and cannot be processed.");
        }

        // 这里保留原始换行结构，交由 clean_content 的结构保留清洗处理，避免切块前丢失段落/标题。
        return content;
      },
    },
    summarize: {
      getEnrichment: getTextAssetEnrichment,
      generateTitle: true,
    },
    deriveDescriptor: {
      createEnrichment: (context) =>
        Promise.resolve(getTextAssetEnrichment(context.state)),
    },
    deriveFacets: {
      getEnrichment: getTextAssetEnrichment,
    },
  }),
});

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
