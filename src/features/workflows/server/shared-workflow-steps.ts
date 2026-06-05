import { z } from "zod";
import type { CreateAssetChunkInput } from "@/core/assets/ports";
import { createLogger } from "@/core/logging/logger";
import type { AssetDetail } from "@/features/assets/model/types";
import type { TextAssetEnrichmentInput } from "@/features/ingest/model/enrichment";
import {
  cleanContentPreservingStructure,
  createChunkEmbeddings,
  generateAssetSummary,
  generateAssetTitle,
  indexPreparedChunks,
  type PreparedChunk,
  persistProcessedContent,
} from "@/features/ingest/server/content-processing";
import { upsertMetadataTermVectors } from "@/features/ingest/server/metadata-terms";
import { deriveAssertionsWithAIFallback } from "./assertion-extraction";
import {
  type AssetAccessPolicy,
  type AssetDescriptor,
  deriveAccessPolicy,
  deriveDescriptor,
  deriveFacets,
} from "./indexing-policy";
import type {
  WorkflowExecutionContext,
  WorkflowStepDefinition,
} from "./runtime";
import { mergeDescriptorWithEnrichment } from "./text-enrichment";

const logger = createLogger("workflow-steps");

const assetTypeSchema = z.enum(["url", "pdf", "note", "image", "chat"]);
const assetSourceKindSchema = z
  .enum(["manual", "browser_extension", "upload", "mcp", "import"])
  .nullable();
const assetDomainSchema = z.enum([
  "engineering",
  "product",
  "research",
  "personal",
  "finance",
  "health",
  "archive",
  "general",
]);
const assetDocumentClassSchema = z.enum([
  "reference_doc",
  "design_doc",
  "bug_note",
  "paper",
  "journal_entry",
  "meeting_note",
  "spec",
  "howto",
  "general_note",
]);
const assetSensitivitySchema = z.enum([
  "public",
  "internal",
  "private",
  "restricted",
]);
const assetAiVisibilitySchema = z.enum(["allow", "summary_only", "deny"]);

const assetDescriptorSchema = z.object({
  version: z.literal(2),
  strategy: z.literal("heuristic_v2"),
  assetType: assetTypeSchema,
  sourceKind: assetSourceKindSchema,
  domain: assetDomainSchema,
  documentClass: assetDocumentClassSchema,
  topics: z.array(z.string()),
  tags: z.array(z.string()),
  collectionKey: z.string().nullable(),
  capturedAt: z.string().nullable(),
  sourceHost: z.string().nullable(),
  language: z.string().nullable(),
  mimeType: z.string().nullable(),
  signals: z.array(z.string()),
}) satisfies z.ZodType<AssetDescriptor>;

const assetAccessPolicySchema = z.object({
  version: z.literal(1),
  strategy: z.literal("heuristic_v1"),
  sensitivity: assetSensitivitySchema,
  aiVisibility: assetAiVisibilitySchema,
  retrievalPriority: z.number(),
  reasons: z.array(z.string()),
}) satisfies z.ZodType<AssetAccessPolicy>;

const preparedChunkSchema = z.object({
  chunkIndex: z.number().int().nonnegative(),
  text: z.string(),
  textPreview: z.string(),
}) satisfies z.ZodType<PreparedChunk>;

const persistedContentSchema = z.object({
  contentText: z.string(),
  contentR2Key: z.string(),
  chunks: z.array(preparedChunkSchema),
});

const embeddingsSchema = z.array(z.array(z.number()));

const indexedChunkSchema = z
  .object({
    chunkIndex: z.number().int().nonnegative(),
    textPreview: z.string(),
    contentText: z.string(),
    vectorId: z.string().nullable().optional(),
  })
  .transform((chunk): CreateAssetChunkInput => {
    if (chunk.vectorId === undefined) {
      return {
        chunkIndex: chunk.chunkIndex,
        textPreview: chunk.textPreview,
        contentText: chunk.contentText,
      };
    }

    return {
      chunkIndex: chunk.chunkIndex,
      textPreview: chunk.textPreview,
      contentText: chunk.contentText,
      vectorId: chunk.vectorId,
    };
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

const readDescriptor = (state: Record<string, unknown>): AssetDescriptor => {
  return validateWorkflowState(
    "descriptor",
    assetDescriptorSchema,
    state.descriptor
  );
};

const readAccessPolicy = (
  state: Record<string, unknown>
): AssetAccessPolicy => {
  return validateWorkflowState(
    "accessPolicy",
    assetAccessPolicySchema,
    state.accessPolicy
  );
};

const readPersistedContent = (state: Record<string, unknown>) => {
  return validateWorkflowState(
    "persistedContent",
    persistedContentSchema,
    state.persistedContent
  );
};

const readEmbeddings = (state: Record<string, unknown>): number[][] => {
  return validateWorkflowState(
    "embeddings",
    embeddingsSchema,
    state.embeddings
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

// summarize — 参数化 enrichment 和 title 生成
export const createSummarizeStep = (options?: {
  getEnrichment?: (
    state: Record<string, unknown>
  ) => TextAssetEnrichmentInput | null;
  generateTitle?: boolean;
}): WorkflowStepDefinition => ({
  key: "summarize",
  type: "summarize",
  execute: async (context) => {
    const normalizedContent = context.state.normalizedContent;

    if (typeof normalizedContent !== "string") {
      throw new Error("Workflow state is missing normalized content.");
    }

    const enrichment = options?.getEnrichment?.(context.state);

    const summary = await generateAssetSummary(context.services.aiProvider, {
      title: context.asset.title,
      content: normalizedContent,
      enrichmentSummary: enrichment?.summary,
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

// derive_descriptor — 参数化 auto-enrichment
export const createDeriveDescriptorStep = (options?: {
  createEnrichment?: (
    context: WorkflowExecutionContext
  ) => Promise<TextAssetEnrichmentInput | null | undefined>;
}): WorkflowStepDefinition => ({
  key: "derive_descriptor",
  type: "derive_descriptor",
  execute: async (context) => {
    const summary = context.state.summary;
    const normalizedContent = context.state.normalizedContent;

    const enrichment = options?.createEnrichment
      ? await options.createEnrichment(context)
      : null;

    const derived = deriveDescriptor({
      asset: context.asset,
      normalizedContent:
        typeof normalizedContent === "string" ? normalizedContent : null,
      summary: typeof summary === "string" ? summary : null,
    });

    const descriptor = mergeDescriptorWithEnrichment(
      derived.descriptor,
      enrichment ?? null
    );

    await context.services.assetRepository.updateAssetIndexing(
      context.asset.id,
      {
        sourceKind: descriptor.sourceKind,
        domain: descriptor.domain,
        documentClass: descriptor.documentClass,
        sourceHost: descriptor.sourceHost,
        collectionKey: descriptor.collectionKey,
        capturedAt: descriptor.capturedAt,
        descriptorJson: JSON.stringify(descriptor),
      }
    );

    return {
      output: {
        domain: descriptor.domain,
        collectionKey: descriptor.collectionKey,
      },
      state: { descriptor },
      artifacts: [
        {
          artifactType: "descriptor",
          storageKind: "inline",
          contentText: JSON.stringify(descriptor),
          metadataJson: JSON.stringify({
            strategy: descriptor.strategy,
          }),
        },
      ],
    };
  },
});

// derive_access_policy — 完全一致
export const createDeriveAccessPolicyStep = (): WorkflowStepDefinition => ({
  key: "derive_access_policy",
  type: "derive_access_policy",
  execute: async (context) => {
    const summary = context.state.summary;
    const normalizedContent = context.state.normalizedContent;
    const descriptor = readDescriptor(context.state);

    const derived = deriveAccessPolicy(
      {
        asset: context.asset,
        normalizedContent:
          typeof normalizedContent === "string" ? normalizedContent : null,
        summary: typeof summary === "string" ? summary : null,
      },
      descriptor
    );

    await context.services.assetRepository.updateAssetIndexing(
      context.asset.id,
      derived.indexing
    );

    return {
      output: {
        sensitivity: derived.policy.sensitivity,
        aiVisibility: derived.policy.aiVisibility,
        retrievalPriority: derived.policy.retrievalPriority,
      },
      state: { accessPolicy: derived.policy },
      artifacts: [
        {
          artifactType: "access_policy",
          storageKind: "inline",
          contentText: JSON.stringify(derived.policy),
          metadataJson: JSON.stringify({
            strategy: derived.policy.strategy,
          }),
        },
      ],
    };
  },
});

// derive_facets — 参数化 enrichment
export const createDeriveFacetsStep = (options?: {
  getEnrichment?: (
    state: Record<string, unknown>
  ) => TextAssetEnrichmentInput | null;
}): WorkflowStepDefinition => ({
  key: "derive_facets",
  type: "derive_facets",
  execute: async (context) => {
    const descriptor = readDescriptor(context.state);
    const accessPolicy = readAccessPolicy(context.state);
    const enrichment = options?.getEnrichment?.(context.state);

    const facets = deriveFacets(descriptor, accessPolicy, enrichment?.facets);

    await context.services.assetRepository.replaceAssetFacets?.(
      context.asset.id,
      facets
    );
    await upsertMetadataTermVectors(
      context.services.vectorStore,
      context.services.aiProvider,
      facets
    );

    return {
      output: { facetCount: facets.length },
    };
  },
});

// derive_assertions — 完全一致
export const createDeriveAssertionsStep = (): WorkflowStepDefinition => ({
  key: "derive_assertions",
  type: "derive_assertions",
  execute: async (context) => {
    const normalizedContent = context.state.normalizedContent;
    const summary = context.state.summary;

    const assertions = await deriveAssertionsWithAIFallback(
      context.services.aiProvider,
      {
        asset: context.asset,
        normalizedContent:
          typeof normalizedContent === "string" ? normalizedContent : null,
        summary: typeof summary === "string" ? summary : null,
      }
    );

    await context.services.assetRepository.replaceAssetAssertions?.(
      context.asset.id,
      assertions
    );

    return {
      output: { assertionCount: assertions.length },
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

    const embeddings = await createChunkEmbeddings(
      context.services.aiProvider,
      persistedContent.chunks
    );

    return {
      output: {
        embeddingCount: embeddings.length,
        dimensions: embeddings[0]?.length ?? 0,
      },
      state: { embeddings },
    };
  },
});

// index — 完全一致
export const createIndexStep = (): WorkflowStepDefinition => ({
  key: "index",
  type: "index",
  execute: async (context) => {
    const persistedContent = readPersistedContent(context.state);
    const embeddings = readEmbeddings(context.state);

    const indexedChunks = await indexPreparedChunks(
      context.services.vectorStore,
      context.asset,
      persistedContent.chunks,
      embeddings
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
export const buildSharedIngestSteps = (options: {
  cleanContent: {
    getContent: (asset: AssetDetail, state: Record<string, unknown>) => string;
  };
  summarize?: {
    getEnrichment?: (
      state: Record<string, unknown>
    ) => TextAssetEnrichmentInput | null;
    generateTitle?: boolean;
  };
  deriveDescriptor?: {
    createEnrichment?: (
      context: WorkflowExecutionContext
    ) => Promise<TextAssetEnrichmentInput | null | undefined>;
  };
  deriveFacets?: {
    getEnrichment?: (
      state: Record<string, unknown>
    ) => TextAssetEnrichmentInput | null;
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
    createDeriveDescriptorStep(options.deriveDescriptor),
    createDeriveAccessPolicyStep(),
    createDeriveFacetsStep(options.deriveFacets),
    createDeriveAssertionsStep(),
    createPersistContentStep(options.persistContent),
    createChunkStep(),
    createEmbedStep(),
    createIndexStep(),
    createFinalizeStep(options.finalize),
  ];
};
