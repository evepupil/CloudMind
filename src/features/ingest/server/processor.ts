import type { AIProvider } from "@/core/ai/ports";
import type { AssetIngestRepository } from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
import type { JobQueue } from "@/core/queue/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { WorkflowRepository } from "@/core/workflows/ports";
import type { AssetDetail } from "@/features/assets/model/types";
import { runNoteIngestWorkflow } from "@/features/workflows/server/note-ingest-workflow";
import { runPdfIngestWorkflow } from "@/features/workflows/server/pdf-ingest-workflow";
import { runUrlIngestWorkflow } from "@/features/workflows/server/url-ingest-workflow";

// 这里实现最小处理器，让采集和重处理共用统一状态流转。
export const processTextAsset = async (
  repository: AssetIngestRepository,
  workflowRepository: WorkflowRepository,
  blobStore: BlobStore,
  vectorStore: VectorStore,
  aiProvider: AIProvider,
  jobQueue: JobQueue,
  assetId: string,
  options?: {
    force?: boolean;
  }
): Promise<AssetDetail> => {
  return runNoteIngestWorkflow(
    repository,
    workflowRepository,
    blobStore,
    vectorStore,
    aiProvider,
    jobQueue,
    assetId,
    options?.force ? "reprocess" : "ingest",
    options
  );
};

export const processUrlAsset = async (
  repository: AssetIngestRepository,
  workflowRepository: WorkflowRepository,
  blobStore: BlobStore,
  vectorStore: VectorStore,
  aiProvider: AIProvider,
  jobQueue: JobQueue,
  assetId: string,
  options?: {
    force?: boolean;
  }
): Promise<AssetDetail> => {
  return runUrlIngestWorkflow(
    repository,
    workflowRepository,
    blobStore,
    vectorStore,
    aiProvider,
    jobQueue,
    assetId,
    options?.force ? "reprocess" : "ingest",
    options
  );
};

export const processPdfAsset = async (
  repository: AssetIngestRepository,
  workflowRepository: WorkflowRepository,
  blobStore: BlobStore,
  vectorStore: VectorStore,
  aiProvider: AIProvider,
  jobQueue: JobQueue,
  assetId: string,
  options?: {
    force?: boolean;
  }
): Promise<AssetDetail> => {
  return runPdfIngestWorkflow(
    repository,
    workflowRepository,
    blobStore,
    vectorStore,
    aiProvider,
    jobQueue,
    assetId,
    options?.force ? "reprocess" : "ingest",
    options
  );
};
