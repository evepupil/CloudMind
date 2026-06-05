import { createHash } from "node:crypto";

import type { AIProvider } from "@/core/ai/ports";
import type { CreateAssetChunkInput } from "@/core/assets/ports";
import { createProcessedContentBlobKey } from "@/core/blob/keys";
import type { BlobStore } from "@/core/blob/ports";
import { createLogger } from "@/core/logging/logger";
import { createChunkVectorId } from "@/core/vector/keys";
import type { VectorStore } from "@/core/vector/ports";
import type { AssetDetail, AssetType } from "@/features/assets/model/types";

import { buildAIInvocationFields } from "./ai-observability";
import { chunkAssetContent } from "./chunking";
import { ingestPromptRegistry } from "./prompts";

export interface PreparedChunk {
  chunkIndex: number;
  text: string;
  textPreview: string;
  contentHash: string;
}

// 这里给每个 chunk 文本算 SHA-256 内容哈希，作为增量重嵌的幂等键（node:crypto 经 nodejs_compat 在 Worker 可用）。
export const computeChunkContentHash = (text: string): string => {
  return createHash("sha256").update(text).digest("hex");
};

// 增量重嵌计划项：reusedVectorId 非空表示内容与模型都未变、可跳过嵌入并复用既有向量。
export interface ChunkEmbeddingPlanItem {
  chunkIndex: number;
  text: string;
  textPreview: string;
  contentHash: string;
  reusedVectorId: string | null;
}

// 这里比对新旧 chunk：同位置且 contentHash 与 embeddingModel 都一致时跳过重嵌（按 hash 幂等），
// 否则（内容变化 / 换模型 / 未知模型）标记为需要重嵌。
export const planChunkEmbeddings = (
  chunks: PreparedChunk[],
  existingChunks: ReadonlyArray<{
    chunkIndex: number;
    contentHash?: string | null | undefined;
    embeddingModel?: string | null | undefined;
    vectorId?: string | null | undefined;
  }>,
  model: string | undefined
): ChunkEmbeddingPlanItem[] => {
  const existingByIndex = new Map(
    existingChunks.map((chunk) => [chunk.chunkIndex, chunk])
  );

  return chunks.map((chunk) => {
    const prior = existingByIndex.get(chunk.chunkIndex);
    const reusable = Boolean(
      model !== undefined &&
        prior?.vectorId &&
        prior.contentHash === chunk.contentHash &&
        prior.embeddingModel === model
    );

    return {
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      textPreview: chunk.textPreview,
      contentHash: chunk.contentHash,
      reusedVectorId: reusable ? (prior?.vectorId ?? null) : null,
    };
  });
};

const MAX_GENERATED_TITLE_CHARS = 120;
const ingestAiLogger = createLogger("ingest_ai");

export const normalizeContent = (content: string): string => {
  return content.replace(/\s+/g, " ").trim();
};

// 这里在切块前做结构保留清洗：压平行内空白，但保留换行/段落/标题/列表标记，
// 让结构感知切块能按真实边界断开（取代旧的 normalizeContent 把结构整体压平）。
export const cleanContentPreservingStructure = (content: string): string => {
  return content
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const createTextSummary = (content: string): string => {
  const normalized = normalizeContent(content);

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177)}...`;
};

const normalizeGeneratedTitle = (value: string): string => {
  return value
    .trim()
    .replace(/^["'`“”‘’#\-\s]+/, "")
    .replace(/["'`“”‘’\s]+$/, "")
    .replace(/\s+/g, " ");
};

const isGeneratedTitleValid = (title: string): boolean => {
  if (!title || title.length > MAX_GENERATED_TITLE_CHARS) {
    return false;
  }

  return true;
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
      ...ingestPromptRegistry.get("summary").build({
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

export const generateAssetTitle = async (
  aiProvider: AIProvider,
  input: {
    currentTitle?: string | null | undefined;
    summary: string;
    content: string;
  }
): Promise<string> => {
  let result:
    | {
        text: string;
        provider?: string | undefined;
        model?: string | undefined;
      }
    | undefined;

  try {
    result = await aiProvider.generateText({
      ...ingestPromptRegistry.get("title").build(input),
      temperature: 0.2,
      maxOutputTokens: 120,
    });
    const title = normalizeGeneratedTitle(result.text);

    if (!isGeneratedTitleValid(title)) {
      throw new Error("AI title generation returned invalid text.");
    }

    ingestAiLogger.info("title_generation_succeeded", {
      ...buildAIInvocationFields(aiProvider, result),
      currentTitleProvided: Boolean(input.currentTitle?.trim()),
      summaryLength: normalizeContent(input.summary).length,
      contentLength: normalizeContent(input.content).length,
    });

    return title;
  } catch (error) {
    ingestAiLogger.error(
      "title_generation_failed",
      {
        ...buildAIInvocationFields(aiProvider, result),
        currentTitleProvided: Boolean(input.currentTitle?.trim()),
        summaryLength: normalizeContent(input.summary).length,
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
  content: string,
  assetType?: AssetType
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
  const chunks: PreparedChunk[] = chunkAssetContent(normalizedContent, {
    assetType,
  }).map((chunk) => ({
    ...chunk,
    contentHash: computeChunkContentHash(chunk.text),
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

export const createChunkEmbeddings = async (
  aiProvider: AIProvider,
  chunks: ReadonlyArray<{ text: string }>
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

// 这里按增量计划落库：只 upsert 需要重嵌的 chunk 向量、复用未变 chunk 的既有向量，
// 清理过期向量，并给每个 chunk 盖上 contentHash / embeddingModel / embeddingDim 以支撑后续增量与模型迁移。
export const indexPlannedChunks = async (
  vectorStore: VectorStore,
  asset: AssetDetail,
  plan: ChunkEmbeddingPlanItem[],
  embeddings: number[][],
  model: string | undefined
): Promise<CreateAssetChunkInput[]> => {
  if (plan.length === 0) {
    await vectorStore.deleteByIds(
      asset.chunks
        .map((chunk) => chunk.vectorId)
        .filter((value): value is string => Boolean(value))
    );

    return [];
  }

  const existingDimByIndex = new Map(
    asset.chunks.map((chunk) => [chunk.chunkIndex, chunk.embeddingDim ?? null])
  );
  const toEmbed = plan.filter((item) => item.reusedVectorId === null);
  const embeddedDim = embeddings[0]?.length ?? null;

  const vectorRecords = toEmbed.map((item, index) => ({
    id: createChunkVectorId(asset.id, item.chunkIndex),
    values: embeddings[index] ?? [],
    metadataJson: JSON.stringify({
      assetId: asset.id,
      chunkIndex: item.chunkIndex,
      textPreview: item.textPreview,
    }),
  }));

  if (vectorRecords.length > 0) {
    await vectorStore.upsert(vectorRecords);
  }

  const nextVectorIds = new Set(
    plan.map((item) => createChunkVectorId(asset.id, item.chunkIndex))
  );
  const staleVectorIds = asset.chunks
    .map((chunk) => chunk.vectorId)
    .filter((value): value is string => Boolean(value))
    .filter((value) => !nextVectorIds.has(value));

  await vectorStore.deleteByIds(staleVectorIds);

  return plan.map((item) => ({
    chunkIndex: item.chunkIndex,
    textPreview: item.textPreview,
    contentText: item.text,
    vectorId: createChunkVectorId(asset.id, item.chunkIndex),
    contentHash: item.contentHash,
    embeddingModel: model ?? null,
    embeddingDim:
      item.reusedVectorId === null
        ? embeddedDim
        : (existingDimByIndex.get(item.chunkIndex) ?? embeddedDim),
  }));
};
