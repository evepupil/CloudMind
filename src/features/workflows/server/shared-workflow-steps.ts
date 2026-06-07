import { z } from "zod";
import type { CreateAssetChunkInput } from "@/core/assets/ports";
import { createLogger } from "@/core/logging/logger";
import type {
  AssetAiVisibility,
  AssetDetail,
} from "@/features/assets/model/types";
import {
  type ChunkEmbeddingPlanItem,
  cleanContentPreservingStructure,
  createChunkEmbeddings,
  generateAssetSummary,
  generateAssetTitle,
  indexPlannedChunks,
  type PreparedChunk,
  persistProcessedContent,
  planChunkEmbeddings,
} from "@/features/ingest/server/content-processing";
import { extractGraphFromText } from "@/features/memory/server/graph-extraction";
import { createReconcileJudge } from "@/features/memory/server/memory-reconcile";
import { writeGraphToMemory } from "@/features/memory/server/memory-write";
import { classifyAsset } from "./classify";
import type {
  WorkflowExecutionContext,
  WorkflowStepDefinition,
} from "./runtime";

const logger = createLogger("workflow-steps");

// 校验 workflow state 里注入的 pinnedVisibility 是合法可见性枚举（state 是 unknown）。
const isAiVisibility = (value: unknown): value is AssetAiVisibility =>
  value === "allow" || value === "summary_only" || value === "deny";

const preparedChunkSchema = z.object({
  chunkIndex: z.number().int().nonnegative(),
  text: z.string(),
  textPreview: z.string(),
  contentHash: z.string(),
}) satisfies z.ZodType<PreparedChunk>;

const persistedContentSchema = z.object({
  contentText: z.string(),
  contentR2Key: z.string(),
  chunks: z.array(preparedChunkSchema),
});

const embeddingsSchema = z.array(z.array(z.number()).nullable());

const chunkPlanItemSchema = z.object({
  chunkIndex: z.number().int().nonnegative(),
  text: z.string(),
  textPreview: z.string(),
  contentHash: z.string(),
  reusedVectorId: z.string().nullable(),
}) satisfies z.ZodType<ChunkEmbeddingPlanItem>;

const indexedChunkSchema = z
  .object({
    chunkIndex: z.number().int().nonnegative(),
    textPreview: z.string(),
    contentText: z.string(),
    vectorId: z.string().nullable().optional(),
    contentHash: z.string().nullable().optional(),
    embeddingModel: z.string().nullable().optional(),
    embeddingDim: z.number().nullable().optional(),
  })
  .transform((chunk): CreateAssetChunkInput => {
    const result: CreateAssetChunkInput = {
      chunkIndex: chunk.chunkIndex,
      textPreview: chunk.textPreview,
      contentText: chunk.contentText,
      contentHash: chunk.contentHash ?? null,
      embeddingModel: chunk.embeddingModel ?? null,
      embeddingDim: chunk.embeddingDim ?? null,
    };

    if (chunk.vectorId !== undefined) {
      result.vectorId = chunk.vectorId;
    }

    return result;
  });

const validateWorkflowState = <T>(
  field: string,
  schema: z.ZodType<T>,
  value: unknown
): T => {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    logger.warn("Invalid workflow state field", {
      field,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });

    throw new Error(`Workflow state field "${field}" is invalid.`);
  }

  return parsed.data;
};

const readPersistedContent = (state: Record<string, unknown>) => {
  return validateWorkflowState(
    "persistedContent",
    persistedContentSchema,
    state.persistedContent
  );
};

const readEmbeddings = (
  state: Record<string, unknown>
): Array<number[] | null> => {
  return validateWorkflowState(
    "embeddings",
    embeddingsSchema,
    state.embeddings
  );
};

const readChunkPlan = (
  state: Record<string, unknown>
): ChunkEmbeddingPlanItem[] => {
  return validateWorkflowState(
    "chunkPlan",
    z.array(chunkPlanItemSchema),
    state.chunkPlan
  );
};

const readIndexedChunks = (
  state: Record<string, unknown>
): CreateAssetChunkInput[] => {
  return validateWorkflowState(
    "indexedChunks",
    z.array(indexedChunkSchema),
    state.indexedChunks
  );
};

// clean_content — 参数化内容来源获取
export const createCleanContentStep = (options: {
  getContent: (asset: AssetDetail, state: Record<string, unknown>) => string;
}): WorkflowStepDefinition => ({
  key: "clean_content",
  type: "clean_content",
  execute: (context) => {
    const content = options.getContent(context.asset, context.state);

    if (!content.trim()) {
      throw new Error("Asset content is empty and cannot be processed.");
    }

    const normalizedContent = cleanContentPreservingStructure(content);

    if (!normalizedContent) {
      throw new Error("Fetched page content is empty after cleaning.");
    }

    return {
      output: { contentLength: normalizedContent.length },
      state: { normalizedContent },
    };
  },
});

// summarize — 参数化 title 生成
export const createSummarizeStep = (options?: {
  generateTitle?: boolean;
}): WorkflowStepDefinition => ({
  key: "summarize",
  type: "summarize",
  execute: async (context) => {
    const normalizedContent = context.state.normalizedContent;

    if (typeof normalizedContent !== "string") {
      throw new Error("Workflow state is missing normalized content.");
    }

    const summary = await generateAssetSummary(context.services.aiProvider, {
      title: context.asset.title,
      content: normalizedContent,
    });

    if (options?.generateTitle) {
      try {
        const generatedTitle = await generateAssetTitle(
          context.services.aiProvider,
          {
            currentTitle: context.asset.title,
            summary,
            content: normalizedContent,
          }
        );

        if (generatedTitle !== context.asset.title) {
          await context.services.assetRepository.updateAssetMetadata(
            context.asset.id,
            { title: generatedTitle }
          );
        }
      } catch (error) {
        logger.warn("Failed to generate asset title", {
          assetId: context.asset.id,
          error: String(error),
        });
      }
    }

    return {
      output: { summaryLength: summary.length },
      state: { summary },
      artifacts: [
        {
          artifactType: "summary",
          storageKind: "inline",
          contentText: summary,
          metadataJson: JSON.stringify({
            workflowType:
              context.asset.type === "url"
                ? "url_ingest_v1"
                : context.asset.type === "pdf"
                  ? "pdf_ingest_v1"
                  : "note_ingest_v1",
          }),
        },
      ],
    };
  },
});

// classify — L1 瘦身后的单一启发式分类步骤，写回 domain/aiVisibility/
// retrievalPriority/sourceKind/sourceHost/collectionKey/capturedAt。
export const createClassifyStep = (): WorkflowStepDefinition => ({
  key: "classify",
  type: "classify",
  execute: async (context) => {
    const summary = context.state.summary;
    const normalizedContent = context.state.normalizedContent;

    const result = classifyAsset({
      asset: context.asset,
      normalizedContent:
        typeof normalizedContent === "string" ? normalizedContent : null,
      summary: typeof summary === "string" ? summary : null,
    });

    // 绝对 pin 语义：调用方在 initialState 注入 pinnedVisibility 时完全说了算，
    // 覆盖自动推导（final = pin ?? classified）。未 pin 时走自动分类。
    // 注：reprocess 不重新注入 pin，会回退自动分类——「持久化 pin 开关」留作后续。
    // priority 仍按推导可见性计算：deny/summary_only 内容本就被检索硬过滤/降权，影响可忽略。
    const pinnedVisibility = isAiVisibility(context.state.pinnedVisibility)
      ? context.state.pinnedVisibility
      : null;
    const aiVisibility = pinnedVisibility ?? result.aiVisibility;
    const finalResult = { ...result, aiVisibility };

    await context.services.assetRepository.updateAssetIndexing(
      context.asset.id,
      {
        sourceKind: result.sourceKind,
        domain: result.domain,
        aiVisibility,
        retrievalPriority: result.retrievalPriority,
        sourceHost: result.sourceHost,
        collectionKey: result.collectionKey,
        capturedAt: result.capturedAt,
      }
    );

    return {
      output: {
        domain: result.domain,
        aiVisibility,
        retrievalPriority: result.retrievalPriority,
        collectionKey: result.collectionKey,
        visibilityPinned: pinnedVisibility !== null,
      },
      state: { classification: finalResult },
      artifacts: [
        {
          artifactType: "classification",
          storageKind: "inline",
          contentText: JSON.stringify(finalResult),
          metadataJson: JSON.stringify({
            strategy: "heuristic_v3",
            signals: pinnedVisibility
              ? [...result.signals, `visibility_pinned:${pinnedVisibility}`]
              : result.signals,
          }),
        },
      ],
    };
  },
});

// persist_content — 参数化 metadata
export const createPersistContentStep = (options?: {
  buildExtraMetadata?: (
    state: Record<string, unknown>
  ) => Record<string, unknown>;
}): WorkflowStepDefinition => ({
  key: "persist_content",
  type: "persist_content",
  execute: async (context) => {
    const normalizedContent = context.state.normalizedContent;

    if (typeof normalizedContent !== "string") {
      throw new Error("Workflow state is missing normalized content.");
    }

    const persistedContent = await persistProcessedContent(
      context.services.blobStore,
      context.asset.id,
      normalizedContent,
      context.asset.type
    );

    const extra = options?.buildExtraMetadata?.(context.state) ?? {};

    return {
      output: { chunkCount: persistedContent.chunks.length },
      state: { persistedContent },
      artifacts: [
        {
          artifactType: "clean_content",
          storageKind: "r2",
          r2Key: persistedContent.contentR2Key,
          metadataJson: JSON.stringify({
            preview: persistedContent.contentText,
            chunkCount: persistedContent.chunks.length,
            ...extra,
          }),
        },
      ],
    };
  },
});

// chunk — 完全一致
export const createChunkStep = (): WorkflowStepDefinition => ({
  key: "chunk",
  type: "chunk",
  execute: (context) => {
    const persistedContent = readPersistedContent(context.state);

    return {
      output: { chunkCount: persistedContent.chunks.length },
    };
  },
});

// embed — 完全一致
export const createEmbedStep = (): WorkflowStepDefinition => ({
  key: "embed",
  type: "embed",
  execute: async (context) => {
    const persistedContent = readPersistedContent(context.state);
    const chunkPlan = planChunkEmbeddings(
      persistedContent.chunks,
      context.asset.chunks,
      context.services.aiProvider.embeddingModel
    );
    const toEmbed = chunkPlan.filter((item) => item.reusedVectorId === null);
    const embeddings = await createChunkEmbeddings(
      context.services.aiProvider,
      toEmbed
    );

    return {
      output: {
        embeddingCount: embeddings.filter((value) => value !== null).length,
        reusedCount: chunkPlan.length - toEmbed.length,
        dimensions: embeddings.find((value) => value !== null)?.length ?? 0,
      },
      state: { chunkPlan, embeddings },
    };
  },
});

// index — 完全一致
export const createIndexStep = (): WorkflowStepDefinition => ({
  key: "index",
  type: "index",
  execute: async (context) => {
    const chunkPlan = readChunkPlan(context.state);
    const embeddings = readEmbeddings(context.state);

    const indexedChunks = await indexPlannedChunks(
      context.services.vectorStore,
      context.asset,
      chunkPlan,
      embeddings,
      context.services.aiProvider.embeddingModel
    );

    return {
      output: { indexedChunkCount: indexedChunks.length },
      state: { indexedChunks },
    };
  },
});

// finalize — 参数化 rawR2Key 与 after hook
export const createFinalizeStep = (options?: {
  getRawR2Key?: (state: Record<string, unknown>) => string | null;
  afterFinalize?: (context: WorkflowExecutionContext) => Promise<void>;
}): WorkflowStepDefinition => ({
  key: "finalize",
  type: "finalize",
  execute: async (context) => {
    const summary = context.state.summary;

    if (typeof summary !== "string") {
      throw new Error("Workflow state is missing summary.");
    }

    const persistedContent = readPersistedContent(context.state);
    const indexedChunks = readIndexedChunks(context.state);

    const rawR2Key = options?.getRawR2Key?.(context.state) ?? null;

    await context.services.assetRepository.completeAssetProcessing(
      context.asset.id,
      {
        summary,
        rawR2Key,
        contentText: persistedContent.contentText,
        contentR2Key: persistedContent.contentR2Key,
      }
    );
    await context.services.assetRepository.replaceAssetChunks(
      context.asset.id,
      indexedChunks
    );

    if (options?.afterFinalize) {
      await options.afterFinalize(context);
    }

    return {
      output: { finalized: true },
    };
  },
});

// 组合函数：构建除 load_source 外的完整步骤列表
// extract_entities — 从清洗后的正文抽取 entities/SPO 写入 L2 知识图谱（激活原本死着的步骤）。
// memoryRepository 未注入、无正文或抽取为空时优雅跳过，绝不阻塞摄取。
export const createExtractEntitiesStep = (): WorkflowStepDefinition => ({
  key: "extract_entities",
  type: "extract_entities",
  execute: async (context) => {
    const memoryRepository = context.services.memoryRepository;
    const normalizedContent = context.state.normalizedContent;

    if (
      !memoryRepository ||
      typeof normalizedContent !== "string" ||
      normalizedContent.trim().length === 0
    ) {
      return { status: "skipped" };
    }

    const graph = await extractGraphFromText(
      context.services.aiProvider,
      normalizedContent
    );

    if (graph.entities.length === 0 && graph.statements.length === 0) {
      return {
        status: "skipped",
        output: { entityCount: 0, statementCount: 0, edgeCount: 0 },
      };
    }

    // 写一条 ingest 情节，让 provenance 既能指回 asset/chunk，也能指回 L1 episode。
    const episode = await memoryRepository.createEpisode({
      kind: "ingest",
      assetId: context.asset.id,
    });

    const result = await writeGraphToMemory(
      memoryRepository,
      { assetId: context.asset.id, episodeId: episode.id },
      graph,
      {
        // 可选 embedding 消歧：graph VectorStore 未绑定时省略（退回精确归一化名匹配）。
        embedDeduplicate: context.services.graphVectorStore
          ? {
              embedAndUpsert: async (entityId, name) => {
                const graphVS = context.services.graphVectorStore!;
                const ai = context.services.aiProvider;

                // 1. embed 实体名
                const embedResult = await ai.createEmbeddings({
                  texts: [name],
                });
                const values = embedResult.embeddings[0];

                if (!values) {
                  return { vectorId: "", mergedEntityId: null };
                }

                // 2. ANN 查 graph_entities namespace
                const matches = await graphVS.search({
                  values,
                  topK: 1,
                });

                // 3. 超阈值 → 合并到已有实体
                if (
                  matches.length > 0 &&
                  matches[0]!.score >= 0.86 &&
                  matches[0]!.id !== entityId
                ) {
                  const existing = await memoryRepository.getEntityByVectorId(
                    matches[0]!.id
                  );

                  if (existing) {
                    // 把新实体的向量也 upsert 进去（增加覆盖面）
                    await graphVS.upsert([
                      {
                        id: matches[0]!.id,
                        values,
                        metadataJson: JSON.stringify({ canonicalName: name }),
                      },
                    ]);

                    return {
                      vectorId: matches[0]!.id,
                      mergedEntityId: existing.id,
                    };
                  }
                }

                // 4. 无合并 → upsert 新向量 + 回填 entity
                const vectorId = `graph:${entityId}`;
                await graphVS.upsert([
                  {
                    id: vectorId,
                    values,
                    metadataJson: JSON.stringify({ canonicalName: name }),
                  },
                ]);
                await memoryRepository.setEntityVectorId(entityId, vectorId);

                return { vectorId, mergedEntityId: null };
              },
            }
          : undefined,
        // 智能写调和：每条新 statement 由 LLM 判 ADD/UPDATE/DELETE/NOOP（mem0 式）。
        reconcile: createReconcileJudge(context.services.aiProvider),
      }
    );

    return {
      output: {
        entityCount: result.entityCount,
        statementCount: result.statementCount,
        edgeCount: result.edgeCount,
      },
      artifacts: [
        {
          artifactType: "entities",
          storageKind: "inline",
          metadataJson: JSON.stringify(result),
        },
      ],
    };
  },
});

export const buildSharedIngestSteps = (options: {
  cleanContent: {
    getContent: (asset: AssetDetail, state: Record<string, unknown>) => string;
  };
  summarize?: {
    generateTitle?: boolean;
  };
  persistContent?: {
    buildExtraMetadata?: (
      state: Record<string, unknown>
    ) => Record<string, unknown>;
  };
  finalize?: {
    getRawR2Key?: (state: Record<string, unknown>) => string | null;
    afterFinalize?: (context: WorkflowExecutionContext) => Promise<void>;
  };
}) => {
  return [
    createCleanContentStep(options.cleanContent),
    createSummarizeStep(options.summarize),
    createClassifyStep(),
    createExtractEntitiesStep(),
    createPersistContentStep(options.persistContent),
    createChunkStep(),
    createEmbedStep(),
    createIndexStep(),
    createFinalizeStep(options.finalize),
  ];
};
