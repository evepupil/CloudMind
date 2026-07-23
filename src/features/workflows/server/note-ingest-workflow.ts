import type { AIProvider } from "@/core/ai/ports";
import type { AssetIngestRepository } from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
import type { JobQueue } from "@/core/queue/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { WorkflowRepository } from "@/core/workflows/ports";
import type {
  AssetAiVisibility,
  AssetDetail,
} from "@/features/assets/model/types";
import { enqueueWorkflow, type WorkflowDefinition } from "./runtime";
import { buildSharedIngestSteps } from "./shared-workflow-steps";
import { loadOrCreateTextSourceSnapshot } from "./text-source-snapshot";

export const createNoteIngestWorkflowDefinition = (): WorkflowDefinition => ({
  type: "note_ingest_v1",
  steps: [
    {
      key: "load_source",
      type: "load_source",
      execute: async (context) => {
        const snapshot = await loadOrCreateTextSourceSnapshot(
          context.asset,
          context.services.assetRepository,
          context.services.blobStore
        );

        return {
          output: {
            rawR2Key: snapshot.rawR2Key,
            sourceLength: snapshot.content.length,
            source: snapshot.source,
          },
          state: {
            rawR2Key: snapshot.rawR2Key,
            sourceContent: snapshot.content,
          },
        };
      },
    },
    ...buildSharedIngestSteps({
      cleanContent: {
        getContent: (_asset, state) => {
          const sourceContent = state.sourceContent;

          if (typeof sourceContent !== "string") {
            throw new Error("Workflow state is missing archived text content.");
          }

          const content = sourceContent.trim();

          if (!content) {
            throw new Error("Asset content is empty and cannot be processed.");
          }

          // 原始快照保留完整输入；这里只清理处理副本两端空白。
          return content;
        },
      },
      summarize: {
        generateTitle: true,
      },
      finalize: {
        getRawR2Key: (state) =>
          typeof state.rawR2Key === "string" ? state.rawR2Key : null,
      },
    }),
  ],
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
    // 显式 pin 的可见性（绝对语义）：注入 workflow initialState，classify 步骤读取后保留不覆盖。
    pinnedVisibility?: AssetAiVisibility;
  }
): Promise<AssetDetail> => {
  // 仅在显式 pin 时注入 initialState，避免给未 pin 的运行写入空状态。
  const initialState = options?.pinnedVisibility
    ? { pinnedVisibility: options.pinnedVisibility }
    : undefined;

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
    initialState
  );
};
