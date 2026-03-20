import type { AIProvider } from "@/core/ai/ports";
import type {
  AssetIngestRepository,
  CreateAssetChunkInput,
} from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { WorkflowRepository } from "@/core/workflows/ports";
import type { AssetDetail } from "@/features/assets/model/types";
import { runNoteIngestWorkflow } from "@/features/workflows/server/note-ingest-workflow";
import { runPdfIngestWorkflow } from "@/features/workflows/server/pdf-ingest-workflow";

const getLatestJob = (asset: AssetDetail) => {
  return asset.jobs[0] ?? null;
};

interface ProcessResult {
  summary: string;
  contentText?: string | null;
  contentR2Key?: string | null;
  chunks?: CreateAssetChunkInput[] | undefined;
}

const runAssetProcessing = async (
  repository: AssetIngestRepository,
  assetId: string,
  execute: (asset: AssetDetail) => Promise<ProcessResult> | ProcessResult,
  options?: {
    force?: boolean;
  }
): Promise<AssetDetail> => {
  const asset = await repository.getAssetById(assetId);
  const latestJob = getLatestJob(asset);

  if (
    !options?.force &&
    (asset.status === "ready" || asset.status === "failed")
  ) {
    return asset;
  }

  try {
    await repository.markAssetProcessing(asset.id);

    if (latestJob) {
      await repository.markIngestJobRunning(latestJob.id);
    }

    const result = await execute(asset);

    const processingInput: {
      summary: string;
      contentText?: string | null;
      contentR2Key?: string | null;
    } = {
      summary: result.summary,
    };

    if (result.contentText !== undefined) {
      processingInput.contentText = result.contentText;
    }

    if (result.contentR2Key !== undefined) {
      processingInput.contentR2Key = result.contentR2Key;
    }

    await repository.completeAssetProcessing(asset.id, processingInput);
    await repository.replaceAssetChunks(asset.id, result.chunks ?? []);

    if (latestJob) {
      await repository.completeIngestJob(latestJob.id);
    }

    return repository.getAssetById(asset.id);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown asset processing error.";

    await repository.failAssetProcessing(asset.id, message);

    if (latestJob) {
      await repository.failIngestJob(latestJob.id, message);
    }

    return repository.getAssetById(asset.id);
  }
};

// 这里实现最小处理器，让采集和重处理共用统一状态流转。
export const processTextAsset = async (
  repository: AssetIngestRepository,
  workflowRepository: WorkflowRepository,
  blobStore: BlobStore,
  vectorStore: VectorStore,
  aiProvider: AIProvider,
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
    assetId,
    options?.force ? "reprocess" : "ingest",
    options
  );
};

export const processUrlAsset = async (
  repository: AssetIngestRepository,
  assetId: string,
  options?: {
    force?: boolean;
  }
): Promise<AssetDetail> => {
  return runAssetProcessing(
    repository,
    assetId,
    (asset) => {
      const sourceUrl = asset.sourceUrl?.trim();

      if (!sourceUrl) {
        throw new Error("Asset URL is empty and cannot be processed.");
      }

      return {
        summary: `Saved URL asset for ${sourceUrl}`,
      };
    },
    options
  );
};

export const processPdfAsset = async (
  repository: AssetIngestRepository,
  workflowRepository: WorkflowRepository,
  blobStore: BlobStore,
  vectorStore: VectorStore,
  aiProvider: AIProvider,
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
    assetId,
    options?.force ? "reprocess" : "ingest",
    options
  );
};
