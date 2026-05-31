import type { CreateAssetChunkInput } from "@/core/assets/ports";
import type { AssetDetail } from "@/features/assets/model/types";
import type { TextAssetEnrichmentInput } from "@/features/ingest/model/enrichment";
import {
  createChunkEmbeddings,
  generateAssetSummary,
  generateAssetTitle,
  indexPreparedChunks,
  normalizeContent,
  type PreparedChunk,
  persistProcessedContent,
} from "@/features/ingest/server/content-processing";
import { upsertMetadataTermVectors } from "@/features/ingest/server/metadata-terms";
import { createLogger } from "@/platform/observability/logger";
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

    const normalizedContent = normalizeContent(content);

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
    const descriptor = context.state.descriptor;
    const summary = context.state.summary;
    const normalizedContent = context.state.normalizedContent;

    if (!descriptor || typeof descriptor !== "object") {
      throw new Error("Workflow state is missing descriptor.");
    }

    const derived = deriveAccessPolicy(
      {
        asset: context.asset,
        normalizedContent:
          typeof normalizedContent === "string" ? normalizedContent : null,
        summary: typeof summary === "string" ? summary : null,
      },
      descriptor as AssetDescriptor
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
    const descriptor = context.state.descriptor;
    const accessPolicy = context.state.accessPolicy;
    const enrichment = options?.getEnrichment?.(context.state);

    if (!descriptor || typeof descriptor !== "object") {
      throw new Error("Workflow state is missing descriptor.");
    }

    if (!accessPolicy || typeof accessPolicy !== "object") {
      throw new Error("Workflow state is missing access policy.");
    }

    const facets = deriveFacets(
      descriptor as AssetDescriptor,
      accessPolicy as AssetAccessPolicy,
      enrichment?.facets
    );

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
      normalizedContent
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
    const persistedContent = context.state.persistedContent;

    if (
      !persistedContent ||
      typeof persistedContent !== "object" ||
      !("chunks" in persistedContent) ||
      !Array.isArray(persistedContent.chunks)
    ) {
      throw new Error("Workflow state is missing persisted content.");
    }

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
    const persistedContent = context.state.persistedContent;

    if (
      !persistedContent ||
      typeof persistedContent !== "object" ||
      !("chunks" in persistedContent) ||
      !Array.isArray(persistedContent.chunks)
    ) {
      throw new Error("Workflow state is missing persisted content.");
    }

    const embeddings = await createChunkEmbeddings(
      context.services.aiProvider,
      persistedContent.chunks as PreparedChunk[]
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
    const persistedContent = context.state.persistedContent;
    const embeddings = context.state.embeddings;

    if (
      !persistedContent ||
      typeof persistedContent !== "object" ||
      !("chunks" in persistedContent) ||
      !Array.isArray(persistedContent.chunks)
    ) {
      throw new Error("Workflow state is missing persisted content.");
    }

    if (!Array.isArray(embeddings)) {
      throw new Error("Workflow state is missing embeddings.");
    }

    const indexedChunks = await indexPreparedChunks(
      context.services.vectorStore,
      context.asset,
      persistedContent.chunks as PreparedChunk[],
      embeddings as number[][]
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
    const persistedContent = context.state.persistedContent;
    const indexedChunks = context.state.indexedChunks;

    if (typeof summary !== "string") {
      throw new Error("Workflow state is missing summary.");
    }

    if (
      !persistedContent ||
      typeof persistedContent !== "object" ||
      !("contentText" in persistedContent) ||
      !("contentR2Key" in persistedContent)
    ) {
      throw new Error("Workflow state is missing persisted content.");
    }

    const rawR2Key = options?.getRawR2Key?.(context.state) ?? null;

    await context.services.assetRepository.completeAssetProcessing(
      context.asset.id,
      {
        summary,
        rawR2Key,
        contentText:
          typeof persistedContent.contentText === "string"
            ? persistedContent.contentText
            : null,
        contentR2Key:
          typeof persistedContent.contentR2Key === "string"
            ? persistedContent.contentR2Key
            : null,
      }
    );
    await context.services.assetRepository.replaceAssetChunks(
      context.asset.id,
      Array.isArray(indexedChunks)
        ? (indexedChunks as CreateAssetChunkInput[])
        : []
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
