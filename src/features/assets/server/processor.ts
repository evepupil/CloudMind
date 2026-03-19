import type { AssetDetail } from "@/features/assets/model/types";

import type { AssetRepository } from "./repository";

const normalizeContent = (content: string): string => {
  return content.replace(/\s+/g, " ").trim();
};

const createTextSummary = (content: string): string => {
  const normalized = normalizeContent(content);

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177)}...`;
};

const getLatestJob = (asset: AssetDetail) => {
  return asset.jobs[0] ?? null;
};

// 这里实现最小处理器：先把文本资产从 pending 推到 ready，后续再拆成真正的异步流水线。
export const processTextAsset = async (
  repository: AssetRepository,
  assetId: string
): Promise<AssetDetail> => {
  const asset = await repository.getAssetById(assetId);
  const latestJob = getLatestJob(asset);

  if (asset.status === "ready" || asset.status === "failed") {
    return asset;
  }

  try {
    await repository.markAssetProcessing(asset.id);

    if (latestJob) {
      await repository.markIngestJobRunning(latestJob.id);
    }

    const content = asset.contentText?.trim();

    if (!content) {
      throw new Error("Asset content is empty and cannot be processed.");
    }

    const summary = createTextSummary(content);

    await repository.completeTextAssetProcessing(asset.id, summary);

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
