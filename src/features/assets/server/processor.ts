import type { AssetDetail } from "@/features/assets/model/types";

import type { BlobStore } from "./blob-store";
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

interface ProcessResult {
  summary: string;
  contentText?: string | null;
}

const processAsset = async (
  repository: AssetRepository,
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

    await repository.completeAssetProcessing(
      asset.id,
      result.summary,
      result.contentText
    );

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

const decodePdfSignature = (body: ArrayBuffer): string => {
  const signatureBytes = body.slice(0, 4);

  return new TextDecoder().decode(signatureBytes);
};

const createPdfPlaceholderContent = (
  asset: AssetDetail,
  size: number,
  contentType: string | undefined
): string => {
  return [
    `PDF asset: ${asset.title}`,
    `Storage: R2`,
    `Raw key: ${asset.rawR2Key ?? "N/A"}`,
    `Detected MIME type: ${contentType ?? asset.mimeType ?? "unknown"}`,
    `Detected size: ${size} bytes`,
    "",
    "This is placeholder content produced by the minimal PDF processor.",
    "A real text extraction pipeline will replace this field later.",
  ].join("\n");
};

// 这里实现最小处理器：先把文本资产从 pending 推到 ready，后续再拆成真正的异步流水线。
export const processTextAsset = async (
  repository: AssetRepository,
  assetId: string,
  options?: {
    force?: boolean;
  }
): Promise<AssetDetail> => {
  return processAsset(
    repository,
    assetId,
    (asset) => {
      const content = asset.contentText?.trim();

      if (!content) {
        throw new Error("Asset content is empty and cannot be processed.");
      }

      return {
        summary: createTextSummary(content),
      };
    },
    options
  );
};

export const processUrlAsset = async (
  repository: AssetRepository,
  assetId: string,
  options?: {
    force?: boolean;
  }
): Promise<AssetDetail> => {
  return processAsset(
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
  repository: AssetRepository,
  blobStore: BlobStore,
  assetId: string,
  options?: {
    force?: boolean;
  }
): Promise<AssetDetail> => {
  return processAsset(
    repository,
    assetId,
    async (asset) => {
      const rawR2Key = asset.rawR2Key?.trim();

      if (!rawR2Key) {
        throw new Error("Asset raw file key is missing.");
      }

      const object = await blobStore.get(rawR2Key);

      if (!object) {
        throw new Error("Asset file was not found in blob storage.");
      }

      if (object.size === 0) {
        throw new Error("Asset file is empty and cannot be processed.");
      }

      if (decodePdfSignature(object.body) !== "%PDF") {
        throw new Error("Uploaded file is not a valid PDF.");
      }

      return {
        summary: `Verified PDF asset in R2 (${object.size} bytes).`,
        contentText: createPdfPlaceholderContent(
          asset,
          object.size,
          object.contentType
        ),
      };
    },
    options
  );
};
