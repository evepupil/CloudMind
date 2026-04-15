import type { AIProvider } from "@/core/ai/ports";
import type { CreateAssetChunkInput } from "@/core/assets/ports";
import { createProcessedContentBlobKey } from "@/core/blob/keys";
import type { BlobStore } from "@/core/blob/ports";
import { createChunkVectorId } from "@/core/vector/keys";
import type { VectorStore } from "@/core/vector/ports";
import type { AssetDetail } from "@/features/assets/model/types";
import { createLogger } from "@/platform/observability/logger";

import { buildAIInvocationFields } from "./ai-observability";
import { chunkAssetContent } from "./chunking";

export interface PreparedChunk {
  chunkIndex: number;
  text: string;
  textPreview: string;
}

const MAX_SUMMARY_SOURCE_CHARS = 12000;
const ingestAiLogger = createLogger("ingest_ai");

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

const buildSummaryPrompt = (input: {
  title?: string | null | undefined;
  content: string;
}): string => {
  const normalizedContent = normalizeContent(input.content);
  const clippedContent = normalizedContent.slice(0, MAX_SUMMARY_SOURCE_CHARS);

  return [
    "请为 CloudMind 资产生成一个高质量摘要。",
    "要求：",
    "- 只输出摘要正文，不要解释，不要列表，不要 Markdown。",
    "- 尽量保留原文语言。",
    "- 摘要应简洁、准确，适合资产列表和检索结果展示。",
    "- 控制在 1 到 3 句。",
    "标题：",
    input.title?.trim() || "(none)",
    "正文：",
    clippedContent,
  ].join("\n");
};

export const generateAssetSummary = async (
  aiProvider: AIProvider,
  input: {
    title?: string | null | undefined;
    content: string;
    enrichmentSummary?: string | null | undefined;
  }
): Promise<string> => {
  const providedSummary = input.enrichmentSummary?.trim();

  if (providedSummary) {
    return providedSummary;
  }

  let result:
    | {
        text: string;
        provider?: string | undefined;
        model?: string | undefined;
      }
    | undefined;

  try {
    result = await aiProvider.generateText({
      prompt: buildSummaryPrompt({
        title: input.title,
        content: input.content,
      }),
      temperature: 0.2,
      maxOutputTokens: 220,
    });
    const summary = normalizeContent(result.text);

    if (!summary) {
      throw new Error("AI summary generation returned empty text.");
    }

    ingestAiLogger.info("summary_generation_succeeded", {
      ...buildAIInvocationFields(aiProvider, result),
      titleProvided: Boolean(input.title?.trim()),
      contentLength: normalizeContent(input.content).length,
    });

    return summary;
  } catch (error) {
    ingestAiLogger.error(
      "summary_generation_failed",
      {
        ...buildAIInvocationFields(aiProvider, result),
        titleProvided: Boolean(input.title?.trim()),
        contentLength: normalizeContent(input.content).length,
      },
      { error }
    );

    throw error;
  }
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
