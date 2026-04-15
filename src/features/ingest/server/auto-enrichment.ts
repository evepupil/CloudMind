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

import { searchMetadataTerms } from "./metadata-terms";

const HIGH_CONFIDENCE_THRESHOLD = 0.86;
const LOW_CONFIDENCE_THRESHOLD = 0.72;

const MAX_TOPICS = 6;
const MAX_TAGS = 6;

const candidateSchema = z.object({
  summary: z.string().trim().min(1).max(2000).optional(),
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

const extractJsonPayload = (text: string): string | null => {
  const trimmed = text.trim();

  if (!trimmed) {
    return null;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
};

const parseJsonObject = (text: string): unknown => {
  const payload = extractJsonPayload(text);

  if (!payload) {
    throw new Error("AI response does not contain a JSON payload.");
  }

  return JSON.parse(payload);
};

const buildCandidatePrompt = (input: AutoEnrichmentInput): string => {
  return [
    "请为 CloudMind 文本资产生成 metadata 候选，返回 JSON。",
    "要求：",
    `- domain 必须从: ${assetDomainValues.join(", ")}`,
    `- documentClass 必须从: ${assetDocumentClassValues.join(", ")}`,
    "- topics/tags 请给多个候选，避免过于宽泛",
    "- catalog 对应 collectionKey，推荐稳定可复用命名",
    "- 不要输出解释文字，只输出 JSON",
    "JSON schema:",
    "{",
    '  "summary": "string?",',
    '  "domain": "enum?",',
    '  "documentClass": "enum?",',
    '  "topics": ["string"],',
    '  "tags": ["string"],',
    '  "catalog": "string?",',
    '  "signals": ["string"]',
    "}",
    "输入标题:",
    input.title?.trim() || "(none)",
    "输入正文:",
    input.content,
  ].join("\n");
};

const buildClassificationPrompt = (
  input: AutoEnrichmentInput,
  enrichment: TextAssetEnrichmentInput
): string => {
  return [
    "请为 CloudMind 文本资产补齐 classification，返回 JSON。",
    "要求：",
    `- domain 必须从: ${assetDomainValues.join(", ")}`,
    `- documentClass 必须从: ${assetDocumentClassValues.join(", ")}`,
    "- 如果已有值合法，可保留；如果缺失，请根据标题、摘要、正文补齐",
    "- 不要输出解释文字，只输出 JSON",
    "JSON schema:",
    "{",
    '  "domain": "enum?",',
    '  "documentClass": "enum?"',
    "}",
    "已有 enrichment:",
    JSON.stringify({
      summary: enrichment.summary,
      domain: enrichment.domain,
      documentClass: enrichment.documentClass,
      descriptor: enrichment.descriptor,
    }),
    "输入标题:",
    input.title?.trim() || "(none)",
    "输入正文:",
    input.content,
  ].join("\n");
};

const buildSelectionPrompt = (
  input: AutoEnrichmentInput,
  candidate: z.infer<typeof candidateSchema>,
  topicHints: TermCandidateWithMatches[],
  tagHints: TermCandidateWithMatches[],
  catalogHints: TermCandidateMatch[]
): string => {
  return [
    "请根据候选 metadata 与已有词项近邻，给出最终选择 JSON。",
    "规则：",
    `- 分数 >= ${HIGH_CONFIDENCE_THRESHOLD.toFixed(2)} 优先复用已有词项`,
    `- 分数 < ${LOW_CONFIDENCE_THRESHOLD.toFixed(2)} 可新建`,
    "- 中间分数区间由你判断最合理方案",
    "- domain/documentClass 只能保留候选中的合法值",
    "- 不要输出解释，只输出 JSON",
    "JSON schema:",
    "{",
    '  "summary": "string?",',
    '  "domain": "enum?",',
    '  "documentClass": "enum?",',
    '  "topics": [{"mode":"reuse|new","value":"string"}],',
    '  "tags": [{"mode":"reuse|new","value":"string"}],',
    '  "catalog": {"mode":"reuse|new","value":"string"},',
    '  "signals": ["string"]',
    "}",
    "候选 metadata:",
    JSON.stringify(candidate),
    "topics 近邻：",
    JSON.stringify(topicHints),
    "tags 近邻：",
    JSON.stringify(tagHints),
    "catalog 近邻：",
    JSON.stringify(catalogHints),
    "输入标题:",
    input.title?.trim() || "(none)",
    "输入正文:",
    input.content,
  ].join("\n");
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

  if (!domain || !documentClass) {
    try {
      const result = await aiProvider.generateText({
        prompt: buildClassificationPrompt(input, input.enrichment),
        temperature: 0.1,
        maxOutputTokens: 400,
      });
      const parsed = classificationSchema.safeParse(
        parseJsonObject(result.text)
      );

      if (parsed.success) {
        domain ??= parsed.data.domain;
        documentClass ??= parsed.data.documentClass;
      }
    } catch {}
  }

  if (!domain || !documentClass) {
    const fallback = deriveHeuristicClassification(input);

    domain ??= fallback.domain;
    documentClass ??= fallback.documentClass;
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
  } catch {
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

// 这里在保存前生成 enrichment，优先复用已有词项向量，减少 topic/tag/catalog 膨胀。
export const generateAutoTextEnrichment = async (
  aiProvider: AIProvider,
  vectorStore: VectorStore,
  input: AutoEnrichmentInput
): Promise<TextAssetEnrichmentInput | undefined> => {
  const candidateResult = await aiProvider.generateText({
    prompt: buildCandidatePrompt(input),
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
      prompt: buildSelectionPrompt(
        input,
        candidate,
        topicHints,
        tagHints,
        catalogHints
      ),
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
