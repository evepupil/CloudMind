import type {
  AssetIngestRepository,
  CreateAssetChunkInput,
} from "@/core/assets/ports";
import { createProcessedContentBlobKey } from "@/core/blob/keys";
import type { BlobStore } from "@/core/blob/ports";
import type { AssetDetail } from "@/features/assets/model/types";

import { chunkAssetContent } from "./chunking";
import { extractPdfText } from "./pdf-extractor";

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

const createContentPreview = (content: string): string => {
  const normalized = normalizeContent(content);

  if (normalized.length <= 500) {
    return normalized;
  }

  return `${normalized.slice(0, 497)}...`;
};

const getLatestJob = (asset: AssetDetail) => {
  return asset.jobs[0] ?? null;
};

interface ProcessResult {
  summary: string;
  contentText?: string | null;
  contentR2Key?: string | null;
  chunks?: CreateAssetChunkInput[] | undefined;
}

const persistProcessedContent = async (
  blobStore: BlobStore,
  assetId: string,
  content: string
): Promise<{
  contentText: string;
  contentR2Key: string;
  chunks: CreateAssetChunkInput[];
}> => {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    throw new Error("Processed asset content is empty.");
  }

  const contentR2Key = createProcessedContentBlobKey(assetId, "txt");
  const chunks = chunkAssetContent(normalizedContent).map((chunk) => ({
    chunkIndex: chunk.chunkIndex,
    textPreview: chunk.textPreview,
    vectorId: null,
  }));

  await blobStore.put({
    key: contentR2Key,
    body: new TextEncoder()
      .encode(normalizedContent)
      .buffer.slice(0) as ArrayBuffer,
    contentType: "text/plain; charset=utf-8",
  });

  return {
    contentText: createContentPreview(normalizedContent),
    contentR2Key,
    chunks,
  };
};

const processAsset = async (
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

const decodePdfSignature = (body: ArrayBuffer): string => {
  const signatureBytes = body.slice(0, 4);

  return new TextDecoder().decode(signatureBytes);
};

// 这里实现最小处理器，让采集和重处理共享统一状态流转。
export const processTextAsset = async (
  repository: AssetIngestRepository,
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
      const content = asset.contentText?.trim();

      if (!content) {
        throw new Error("Asset content is empty and cannot be processed.");
      }

      const persistedContent = await persistProcessedContent(
        blobStore,
        asset.id,
        normalizeContent(content)
      );

      return {
        summary: createTextSummary(content),
        contentText: persistedContent.contentText,
        contentR2Key: persistedContent.contentR2Key,
        chunks: persistedContent.chunks,
      };
    },
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
  repository: AssetIngestRepository,
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

      let extractedText: Awaited<ReturnType<typeof extractPdfText>>;

      try {
        extractedText = await extractPdfText(object.body);
      } catch {
        throw new Error("Failed to extract text from PDF.");
      }

      if (!extractedText.text) {
        throw new Error("No extractable text was found in the PDF.");
      }

      const persistedContent = await persistProcessedContent(
        blobStore,
        asset.id,
        extractedText.text
      );

      return {
        summary: createTextSummary(extractedText.text),
        contentText: persistedContent.contentText,
        contentR2Key: persistedContent.contentR2Key,
        chunks: persistedContent.chunks,
      };
    },
    options
  );
};
