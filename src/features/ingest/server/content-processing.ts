import type { AIProvider } from "@/core/ai/ports";
import type { CreateAssetChunkInput } from "@/core/assets/ports";
import { createProcessedContentBlobKey } from "@/core/blob/keys";
import type { BlobStore } from "@/core/blob/ports";
import { createChunkVectorId } from "@/core/vector/keys";
import type { VectorStore } from "@/core/vector/ports";
import type { AssetDetail } from "@/features/assets/model/types";

import { chunkAssetContent } from "./chunking";

export interface PreparedChunk {
  chunkIndex: number;
  text: string;
  textPreview: string;
}

export const normalizeContent = (content: string): string => {
  return content.replace(/\s+/g, " ").trim();
};

export const createTextSummary = (content: string): string => {
  const normalized = normalizeContent(content);

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177)}...`;
};

export const createContentPreview = (content: string): string => {
  const normalized = normalizeContent(content);

  if (normalized.length <= 500) {
    return normalized;
  }

  return `${normalized.slice(0, 497)}...`;
};

export const persistProcessedContent = async (
  blobStore: BlobStore,
  assetId: string,
  content: string
): Promise<{
  contentText: string;
  contentR2Key: string;
  chunks: PreparedChunk[];
}> => {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    throw new Error("Processed asset content is empty.");
  }

  const contentR2Key = createProcessedContentBlobKey(assetId, "txt");
  const chunks = chunkAssetContent(normalizedContent);

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

export const createChunkEmbeddings = async (
  aiProvider: AIProvider,
  chunks: PreparedChunk[]
): Promise<number[][]> => {
  if (chunks.length === 0) {
    return [];
  }

  const { embeddings } = await aiProvider.createEmbeddings({
    texts: chunks.map((chunk) => chunk.text),
    purpose: "document",
  });

  if (embeddings.length !== chunks.length) {
    throw new Error("Embedding count does not match processed chunk count.");
  }

  return embeddings;
};

export const indexPreparedChunks = async (
  vectorStore: VectorStore,
  asset: AssetDetail,
  chunks: PreparedChunk[],
  embeddings: number[][]
): Promise<CreateAssetChunkInput[]> => {
  if (chunks.length === 0) {
    await vectorStore.deleteByIds(
      asset.chunks
        .map((chunk) => chunk.vectorId)
        .filter((value): value is string => Boolean(value))
    );

    return [];
  }

  const vectorRecords = chunks.map((chunk, index) => {
    const vectorId = createChunkVectorId(asset.id, chunk.chunkIndex);

    return {
      id: vectorId,
      values: embeddings[index] ?? [],
      metadataJson: JSON.stringify({
        assetId: asset.id,
        chunkIndex: chunk.chunkIndex,
        textPreview: chunk.textPreview,
      }),
    };
  });

  await vectorStore.upsert(vectorRecords);

  const nextVectorIds = new Set(vectorRecords.map((record) => record.id));
  const staleVectorIds = asset.chunks
    .map((chunk) => chunk.vectorId)
    .filter((value): value is string => Boolean(value))
    .filter((value) => !nextVectorIds.has(value));

  await vectorStore.deleteByIds(staleVectorIds);

  return chunks.map((chunk) => ({
    chunkIndex: chunk.chunkIndex,
    textPreview: chunk.textPreview,
    contentText: chunk.text,
    vectorId: createChunkVectorId(asset.id, chunk.chunkIndex),
  }));
};
