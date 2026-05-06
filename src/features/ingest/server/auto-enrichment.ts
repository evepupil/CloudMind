import { z } from "zod";
import type { AIProvider } from "@/core/ai/ports";
import type { VectorStore } from "@/core/vector/ports";
import type {
  AssetDetail,
  AssetSourceKind,
} from "@/features/assets/model/types";
import {
  assetDocumentClassValues,
  assetDomainValues,
  type TextAssetEnrichmentInput,
  textAssetEnrichmentSchema,
} from "@/features/ingest/model/enrichment";
import { normalizeContent } from "@/features/ingest/server/content-processing";
import { deriveDescriptor } from "@/features/workflows/server/indexing-policy";
import { createLogger } from "@/platform/observability/logger";

import { buildAIInvocationFields } from "./ai-observability";
import { searchMetadataTerms } from "./metadata-terms";
import { ingestPromptRegistry, parseJsonObject } from "./prompts";

const HIGH_CONFIDENCE_THRESHOLD = 0.86;
const LOW_CONFIDENCE_THRESHOLD = 0.72;

const MAX_TOPICS = 6;
const MAX_TAGS = 6;
const enrichmentLogger = createLogger("ingest_enrichment");

const candidateSchema = z.object({
  summary: z.string().trim().min(1).max(2000).optional(),
  domain: z.enum(assetDomainValues).optional(),
  documentClass: z.enum(assetDocumentClassValues).optional(),
  topics: z.array(z.string().trim().min(1).max(80)).max(MAX_TOPICS).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(MAX_TAGS).optional(),
  catalog: z.string().trim().min(1).max(120).optional(),
  signals: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
});

const descriptorCandidateSchema = z.object({
  domain: z.enum(assetDomainValues).optional(),
  documentClass: z.enum(assetDocumentClassValues).optional(),
  topics: z.array(z.string().trim().min(1).max(80)).max(MAX_TOPICS).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(MAX_TAGS).optional(),
  catalog: z.string().trim().min(1).max(120).optional(),
  signals: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
});

const classificationSchema = z.object({
  domain: z.enum(assetDomainValues).optional(),
  documentClass: z.enum(assetDocumentClassValues).optional(),
});

const decisionItemSchema = z.object({
  mode: z.enum(["reuse", "new"]),
  value: z.string().trim().min(1).max(120),
});

const finalizedSchema = z.object({
  summary: z.string().trim().min(1).max(2000).optional(),
  domain: z.enum(assetDomainValues).optional(),
  documentClass: z.enum(assetDocumentClassValues).optional(),
  topics: z.array(decisionItemSchema).max(MAX_TOPICS).optional(),
  tags: z.array(decisionItemSchema).max(MAX_TAGS).optional(),
  catalog: decisionItemSchema.optional(),
  signals: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
});

interface AutoEnrichmentInput {
  title?: string | undefined;
  content: string;
}

interface WorkflowDescriptorEnrichmentInput extends AutoEnrichmentInput {
  summary?: string | undefined;
  sourceKind?: AssetSourceKind | undefined;
}

interface StandardizeProvidedEnrichmentInput extends AutoEnrichmentInput {
  sourceKind?: AssetSourceKind | undefined;
  enrichment: TextAssetEnrichmentInput;
}

interface TermCandidateMatch {
  term: string;
  score: number;
}

interface TermCandidateWithMatches {
  candidate: string;
  matches: TermCandidateMatch[];
}

const normalizeUnique = (values: string[] | undefined): string[] => {
  if (!values?.length) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
};

const pickFallbackValues = (
  candidates: string[],
  hints: TermCandidateWithMatches[]
): string[] => {
  const picked: string[] = [];

  for (const candidate of candidates) {
    const matches =
      hints.find((item) => item.candidate === candidate)?.matches ?? [];
    const best = matches[0];

    if (best && best.score >= HIGH_CONFIDENCE_THRESHOLD) {
      picked.push(best.term);
      continue;
    }

    if (!best || best.score < LOW_CONFIDENCE_THRESHOLD) {
      picked.push(candidate);
      continue;
    }

    picked.push(best.term);
  }

  return normalizeUnique(picked);
};

const pickProvidedValues = (
  candidates: string[],
  hints: TermCandidateWithMatches[]
): string[] => {
  return normalizeUnique(
    candidates.map((candidate) => {
      const best =
        hints.find((item) => item.candidate === candidate)?.matches[0] ?? null;

      if (best && best.score >= HIGH_CONFIDENCE_THRESHOLD) {
        return best.term;
      }

      return candidate;
    })
  );
};

const toEnrichment = (
  candidate: z.infer<typeof candidateSchema>,
  finalized: z.infer<typeof finalizedSchema> | null,
  topicHints: TermCandidateWithMatches[],
  tagHints: TermCandidateWithMatches[],
  catalogHints: TermCandidateMatch[]
): TextAssetEnrichmentInput | undefined => {
  const selectedTopics = finalized?.topics
    ? normalizeUnique(finalized.topics.map((item) => item.value))
    : pickFallbackValues(candidate.topics ?? [], topicHints);
  const selectedTags = finalized?.tags
    ? normalizeUnique(finalized.tags.map((item) => item.value))
    : pickFallbackValues(candidate.tags ?? [], tagHints);
  const selectedCatalog = finalized?.catalog?.value
    ? finalized.catalog.value.trim()
    : catalogHints[0] && catalogHints[0].score >= HIGH_CONFIDENCE_THRESHOLD
      ? catalogHints[0].term
      : candidate.catalog;

  const enrichment: TextAssetEnrichmentInput = {
    summary: finalized?.summary ?? candidate.summary,
    domain: finalized?.domain ?? candidate.domain,
    documentClass: finalized?.documentClass ?? candidate.documentClass,
    descriptor: {
      topics: selectedTopics.length > 0 ? selectedTopics : undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      collectionKey: selectedCatalog?.trim() || undefined,
      signals: normalizeUnique(finalized?.signals ?? candidate.signals),
    },
  };
  const parsed = textAssetEnrichmentSchema.safeParse(enrichment);

  if (!parsed.success) {
    return undefined;
  }

  const hasValue = Boolean(
    parsed.data.summary !== undefined ||
      parsed.data.domain !== undefined ||
      parsed.data.documentClass !== undefined ||
      (parsed.data.descriptor?.topics?.length ?? 0) > 0 ||
      (parsed.data.descriptor?.tags?.length ?? 0) > 0 ||
      Boolean(parsed.data.descriptor?.collectionKey) ||
      (parsed.data.descriptor?.signals?.length ?? 0) > 0
  );

  return hasValue ? parsed.data : undefined;
};

const buildTermHints = async (
  vectorStore: VectorStore,
  aiProvider: AIProvider,
  kind: "topic" | "tag" | "catalog",
  terms: string[]
): Promise<TermCandidateWithMatches[]> => {
  const uniqueTerms = normalizeUnique(terms);
  const hints: TermCandidateWithMatches[] = [];

  for (const term of uniqueTerms) {
    const matches = await searchMetadataTerms(
      vectorStore,
      aiProvider,
      kind,
      term,
      6
    );

    hints.push({
      candidate: term,
      matches: matches.map((item) => ({
        term: item.term,
        score: item.score,
      })),
    });
  }

  return hints;
};

const buildSyntheticTextAsset = (
  input: StandardizeProvidedEnrichmentInput
): AssetDetail => {
  const now = new Date().toISOString();
  const sourceKind = input.sourceKind ?? "manual";

  return {
    id: "synthetic-text-enrichment",
    type: "note",
    title: input.title?.trim() || "Untitled Note",
    summary: input.enrichment.summary ?? null,
    sourceUrl: null,
    sourceKind,
    status: "pending",
    domain: "general",
    sensitivity: "internal",
    aiVisibility: "allow",
    retrievalPriority: 0,
    documentClass: "general_note",
    sourceHost: null,
    collectionKey: input.enrichment.descriptor?.collectionKey?.trim() || null,
    capturedAt: now,
    descriptorJson: null,
    createdAt: now,
    updatedAt: now,
    contentText: input.content,
    rawR2Key: null,
    contentR2Key: null,
    mimeType: "text/plain",
    language: null,
    errorMessage: null,
    processedAt: null,
    failedAt: null,
    source: {
      kind: sourceKind,
      sourceUrl: null,
      metadataJson: null,
      createdAt: now,
    },
    jobs: [],
    chunks: [],
  };
};

const deriveHeuristicClassification = (
  input: StandardizeProvidedEnrichmentInput
): z.infer<typeof classificationSchema> => {
  const { descriptor } = deriveDescriptor({
    asset: buildSyntheticTextAsset(input),
    normalizedContent: normalizeContent(input.content),
    summary: input.enrichment.summary ?? null,
  });

  return {
    domain: descriptor.domain,
    documentClass: descriptor.documentClass,
  };
};

const resolveClassification = async (
  aiProvider: AIProvider,
  input: StandardizeProvidedEnrichmentInput
): Promise<z.infer<typeof classificationSchema>> => {
  let domain = input.enrichment.domain;
  let documentClass = input.enrichment.documentClass;
  let fallbackReason: "ai_failed" | "ai_invalid" | null = null;

  if (!domain || !documentClass) {
    try {
      const result = await aiProvider.generateText({
        ...ingestPromptRegistry.get("enrichment-classification").build({
          title: input.title,
          content: input.content,
          enrichment: input.enrichment,
        }),
        temperature: 0.1,
        maxOutputTokens: 400,
      });
      const parsed = classificationSchema.safeParse(
        parseJsonObject(result.text)
      );

      if (parsed.success) {
        enrichmentLogger.info("classification_generation_succeeded", {
          ...buildAIInvocationFields(aiProvider, result),
          missingDomain: !input.enrichment.domain,
          missingDocumentClass: !input.enrichment.documentClass,
        });
        domain ??= parsed.data.domain;
        documentClass ??= parsed.data.documentClass;
      } else {
        fallbackReason = "ai_invalid";
        enrichmentLogger.warn("classification_generation_invalid", {
          ...buildAIInvocationFields(aiProvider, result),
          missingDomain: !input.enrichment.domain,
          missingDocumentClass: !input.enrichment.documentClass,
        });
      }
    } catch (error) {
      fallbackReason = "ai_failed";
      enrichmentLogger.warn(
        "classification_generation_failed",
        {
          ...buildAIInvocationFields(aiProvider),
          missingDomain: !input.enrichment.domain,
          missingDocumentClass: !input.enrichment.documentClass,
        },
        { error }
      );
    }
  }

  if (!domain || !documentClass) {
    const fallback = deriveHeuristicClassification(input);

    domain ??= fallback.domain;
    documentClass ??= fallback.documentClass;
    enrichmentLogger.warn("classification_fallback_to_heuristic", {
      fallbackReason: fallbackReason ?? "missing_fields",
      resolvedDomain: domain,
      resolvedDocumentClass: documentClass,
    });
  }

  return {
    domain,
    documentClass,
  };
};

const buildTermHintsSafely = async (
  vectorStore: VectorStore,
  aiProvider: AIProvider,
  kind: "topic" | "tag" | "catalog",
  terms: string[]
): Promise<TermCandidateWithMatches[]> => {
  try {
    return await buildTermHints(vectorStore, aiProvider, kind, terms);
  } catch (error) {
    enrichmentLogger.warn(
      "provided_enrichment_term_normalization_fallback",
      {
        ...buildAIInvocationFields(aiProvider),
        kind,
        candidateCount: normalizeUnique(terms).length,
        fallbackStrategy: "keep_original",
      },
      { error }
    );

    return [];
  }
};

// 这里对客户端传入的 enrichment 再做一次标准化，优先复用已有词项并补齐缺失分类。
export const standardizeProvidedTextEnrichment = async (
  aiProvider: AIProvider,
  vectorStore: VectorStore,
  input: StandardizeProvidedEnrichmentInput
): Promise<TextAssetEnrichmentInput> => {
  const parsedInput = textAssetEnrichmentSchema.safeParse(input.enrichment);

  if (!parsedInput.success) {
    return input.enrichment;
  }

  const enrichment = parsedInput.data;
  const [classification, topicHints, tagHints, catalogHintsWrapped] =
    await Promise.all([
      resolveClassification(aiProvider, {
        ...input,
        enrichment,
      }),
      buildTermHintsSafely(
        vectorStore,
        aiProvider,
        "topic",
        enrichment.descriptor?.topics ?? []
      ),
      buildTermHintsSafely(
        vectorStore,
        aiProvider,
        "tag",
        enrichment.descriptor?.tags ?? []
      ),
      buildTermHintsSafely(
        vectorStore,
        aiProvider,
        "catalog",
        enrichment.descriptor?.collectionKey
          ? [enrichment.descriptor.collectionKey]
          : []
      ),
    ]);
  const catalogBest = catalogHintsWrapped[0]?.matches[0] ?? null;
  const topics = pickProvidedValues(
    enrichment.descriptor?.topics ?? [],
    topicHints
  );
  const tags = pickProvidedValues(enrichment.descriptor?.tags ?? [], tagHints);
  const collectionKey =
    catalogBest && catalogBest.score >= HIGH_CONFIDENCE_THRESHOLD
      ? catalogBest.term
      : enrichment.descriptor?.collectionKey?.trim() || undefined;
  const signals = normalizeUnique(enrichment.descriptor?.signals);
  const hasDescriptor =
    topics.length > 0 ||
    tags.length > 0 ||
    Boolean(collectionKey) ||
    signals.length > 0;
  const standardized = textAssetEnrichmentSchema.safeParse({
    summary: enrichment.summary,
    domain: classification.domain,
    documentClass: classification.documentClass,
    descriptor: hasDescriptor
      ? {
          topics: topics.length > 0 ? topics : undefined,
          tags: tags.length > 0 ? tags : undefined,
          collectionKey,
          signals: signals.length > 0 ? signals : undefined,
        }
      : undefined,
    facets: enrichment.facets,
  });

  return standardized.success ? standardized.data : enrichment;
};

// 这里给 workflow 生成 descriptor enrichment，让 URL/PDF 也能复用 AI descriptor 与 term 归一。
export const generateWorkflowDescriptorEnrichment = async (
  aiProvider: AIProvider,
  vectorStore: VectorStore,
  input: WorkflowDescriptorEnrichmentInput
): Promise<TextAssetEnrichmentInput | undefined> => {
  let result:
    | {
        text: string;
        provider?: string | undefined;
        model?: string | undefined;
      }
    | undefined;

  try {
    result = await aiProvider.generateText({
      ...ingestPromptRegistry.get("enrichment-descriptor").build(input),
      temperature: 0.2,
      maxOutputTokens: 900,
    });
  } catch (error) {
    enrichmentLogger.warn(
      "workflow_descriptor_generation_failed",
      {
        ...buildAIInvocationFields(aiProvider),
        fallbackStrategy: "heuristic_descriptor",
      },
      { error }
    );

    return undefined;
  }

  let parsed: ReturnType<typeof descriptorCandidateSchema.safeParse>;

  try {
    parsed = descriptorCandidateSchema.safeParse(parseJsonObject(result.text));
  } catch (error) {
    enrichmentLogger.warn(
      "workflow_descriptor_generation_invalid",
      {
        ...buildAIInvocationFields(aiProvider, result),
        fallbackStrategy: "heuristic_descriptor",
      },
      { error }
    );

    return undefined;
  }

  if (!parsed.success) {
    enrichmentLogger.warn("workflow_descriptor_generation_invalid", {
      ...buildAIInvocationFields(aiProvider, result),
      fallbackStrategy: "heuristic_descriptor",
    });

    return undefined;
  }

  enrichmentLogger.info("workflow_descriptor_generation_succeeded", {
    ...buildAIInvocationFields(aiProvider, result),
  });

  try {
    return await standardizeProvidedTextEnrichment(aiProvider, vectorStore, {
      title: input.title,
      content: input.content,
      sourceKind: input.sourceKind,
      enrichment: {
        domain: parsed.data.domain,
        documentClass: parsed.data.documentClass,
        descriptor: {
          topics: parsed.data.topics,
          tags: parsed.data.tags,
          collectionKey: parsed.data.catalog,
          signals: parsed.data.signals,
        },
      },
    });
  } catch (error) {
    enrichmentLogger.warn(
      "workflow_descriptor_standardization_skipped",
      {
        ...buildAIInvocationFields(aiProvider, result),
        fallbackStrategy: "heuristic_descriptor",
      },
      { error }
    );

    return undefined;
  }
};

// 这里在保存前生成 enrichment，优先复用已有词项向量，减少 topic/tag/catalog 膨胀。
export const generateAutoTextEnrichment = async (
  aiProvider: AIProvider,
  vectorStore: VectorStore,
  input: AutoEnrichmentInput
): Promise<TextAssetEnrichmentInput | undefined> => {
  const candidateResult = await aiProvider.generateText({
    ...ingestPromptRegistry.get("enrichment-candidate").build(input),
    temperature: 0.2,
    maxOutputTokens: 1200,
  });
  const candidateParsed = candidateSchema.safeParse(
    parseJsonObject(candidateResult.text)
  );

  if (!candidateParsed.success) {
    return undefined;
  }

  const candidate = candidateParsed.data;
  const [topicHints, tagHints, catalogHintsWrapped] = await Promise.all([
    buildTermHints(vectorStore, aiProvider, "topic", candidate.topics ?? []),
    buildTermHints(vectorStore, aiProvider, "tag", candidate.tags ?? []),
    buildTermHints(
      vectorStore,
      aiProvider,
      "catalog",
      candidate.catalog ? [candidate.catalog] : []
    ),
  ]);
  const catalogHints = catalogHintsWrapped[0]?.matches ?? [];

  let finalized: z.infer<typeof finalizedSchema> | null = null;

  try {
    const finalizedResult = await aiProvider.generateText({
      ...ingestPromptRegistry.get("enrichment-selection").build({
        title: input.title,
        content: input.content,
        candidate,
        topicHints,
        tagHints,
        catalogHints,
      }),
      temperature: 0.1,
      maxOutputTokens: 1200,
    });
    const finalizedParsed = finalizedSchema.safeParse(
      parseJsonObject(finalizedResult.text)
    );

    if (finalizedParsed.success) {
      finalized = finalizedParsed.data;
    }
  } catch {
    finalized = null;
  }

  return toEnrichment(candidate, finalized, topicHints, tagHints, catalogHints);
};
