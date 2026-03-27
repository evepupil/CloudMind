import type { AIProvider } from "@/core/ai/ports";
import type { AssetSearchRepository } from "@/core/assets/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { AppBindings } from "@/env";
import type { ContextRetrievalPolicy } from "@/features/mcp/server/context-profiles";
import type { EvidenceItem } from "@/features/search/model/evidence";
import { scoreAssetAssertionMatch } from "@/features/search/server/assertion-scoring";
import {
  applyContextPolicyScore,
  getContextResultScope,
  matchesContextPolicyAsset,
} from "@/features/search/server/context-policy";
import {
  annotateEvidenceMatchReasons,
  buildAssertionEvidenceItem,
  buildChunkEvidenceItem,
  buildEvidencePacket,
  buildGroupedEvidence,
  buildSummaryEvidenceItem,
  flattenGroupedEvidence,
} from "@/features/search/server/evidence";
import { scoreAssetSummaryMatch } from "@/features/search/server/summary-scoring";
import { getAIProviderFromBindings } from "@/platform/ai/workers-ai/get-ai-provider";
import { getAssetSearchRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";
import { getVectorStoreFromBindings } from "@/platform/vector/vectorize/get-vector-store";
import type {
  AskLibraryIndexingSummary,
  AskLibraryInput,
  AskLibraryResult,
  ChatSource,
} from "../model/types";

interface ChatServiceDependencies {
  getAssetRepository: (
    bindings: AppBindings | undefined
  ) => AssetSearchRepository | Promise<AssetSearchRepository>;
  getVectorStore: (
    bindings: AppBindings | undefined
  ) => VectorStore | Promise<VectorStore>;
  getAiProvider: (
    bindings: AppBindings | undefined
  ) => AIProvider | Promise<AIProvider>;
}

const defaultDependencies: ChatServiceDependencies = {
  getAssetRepository: getAssetSearchRepositoryFromBindings,
  getVectorStore: getVectorStoreFromBindings,
  getAiProvider: getAIProviderFromBindings,
};

const createFallbackAnswer = (): string => {
  return (
    "I could not find enough relevant context in your library to answer " +
    "that yet."
  );
};

const CHAT_ALLOWED_AI_VISIBILITY = ["allow"] as const;
const CHAT_SUMMARY_ONLY_AI_VISIBILITY = ["summary_only"] as const;
const BASE_CHAT_SYSTEM_PROMPT =
  "You are a source-aware knowledge base assistant. " +
  "Keep answers concise and grounded in the provided sources. " +
  "Do not repeat the source list. Do not output labels such as " +
  "'Asset ID', 'Source Type', 'Source URL', or 'Snippet'.";
const RETRY_CHAT_SYSTEM_PROMPT =
  `${BASE_CHAT_SYSTEM_PROMPT} ` +
  "Return a complete standalone answer. " +
  "Do not say 'same as above', 'same as v2', or refer to an unseen " +
  "previous answer. Preserve bullet formatting when using lists.";
const SOURCE_TYPE_PRIORITY: Record<ChatSource["sourceType"], number> = {
  chunk: 4,
  assertion: 3,
  term: 2,
  summary: 1,
};
const MIN_RELATIVE_CONTEXT_SCORE_RATIO = 0.42;
const MIN_SECONDARY_ASSET_SCORE_RATIO = 0.65;
const MAX_CONTEXTS_PER_ASSET = 2;
const MIN_SECONDARY_CONTEXT_RELEVANCE = 0.22;

const isProfileBoosted = (
  context: GroundingContext,
  contextPolicy: ContextRetrievalPolicy | undefined
): boolean => {
  return Boolean(contextPolicy?.boostedDomains.includes(context.asset.domain));
};

const buildPrompt = (question: string, sources: ChatSource[]): string => {
  const sourceBlocks = sources
    .map((source, index) => {
      return [
        `[S${index + 1}] ${source.title}`,
        `Asset ID: ${source.assetId}`,
        `Source Type: ${source.sourceType}`,
        source.sourceUrl ? `Source URL: ${source.sourceUrl}` : null,
        `Snippet: ${source.snippet}`,
      ]
        .filter((value): value is string => value !== null)
        .join("\n");
    })
    .join("\n\n");

  return [
    "Answer the user's question using only the provided library sources.",
    "If the sources are insufficient, say so plainly.",
    "When making a claim, cite the relevant source labels like [S1].",
    "",
    `Question: ${question}`,
    "",
    "Sources:",
    sourceBlocks,
  ].join("\n");
};

const collectUniqueLimited = (
  values: Array<string | null | undefined>,
  limit: number
): string[] => {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value?.trim();

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);

    if (result.length >= limit) {
      break;
    }
  }

  return result;
};

const buildChatSource = (context: EvidenceItem): ChatSource => {
  return {
    sourceType: context.layer,
    assetId: context.asset.id,
    chunkId: context.chunkId,
    title: context.asset.title,
    sourceUrl: context.source.sourceUrl,
    snippet: context.snippet,
  };
};

const buildIndexingSummary = (
  contexts: GroundingContext[]
): AskLibraryIndexingSummary => {
  return {
    matchedLayers: collectUniqueLimited(
      contexts.map((context) => context.layer),
      3
    ) as Array<ChatSource["sourceType"]>,
    domains: collectUniqueLimited(
      contexts.map((context) => context.asset.domain),
      4
    ),
    documentClasses: collectUniqueLimited(
      contexts.map((context) => context.asset.documentClass ?? null),
      4
    ),
    sourceKinds: collectUniqueLimited(
      contexts.map((context) => context.asset.sourceKind ?? null),
      4
    ),
    sourceHosts: collectUniqueLimited(
      contexts.map((context) => context.asset.sourceHost ?? null),
      4
    ),
    collections: collectUniqueLimited(
      contexts.map((context) => context.asset.collectionKey),
      4
    ),
    topics: collectUniqueLimited(
      contexts.flatMap((context) => context.indexing.topics),
      6
    ),
  };
};

type GroundingContext = EvidenceItem;

const MIN_CONTEXT_TOKEN_LENGTH = 2;
const MIN_CONTEXT_COVERAGE = 0.18;
const MIN_CONTEXT_SCORE = 0.8;
const MIN_CONTEXT_COUNT = 2;
const CONTEXT_STOP_WORDS = new Set([
  "about",
  "also",
  "based",
  "been",
  "best",
  "both",
  "could",
  "each",
  "does",
  "from",
  "have",
  "how",
  "into",
  "just",
  "more",
  "need",
  "only",
  "over",
  "should",
  "that",
  "this",
  "those",
  "through",
  "using",
  "what",
  "when",
  "where",
  "which",
  "with",
  "your",
]);

const tokenizeForCoverage = (value: string): string[] => {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= MIN_CONTEXT_TOKEN_LENGTH &&
        !CONTEXT_STOP_WORDS.has(token)
    );
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const buildTokenSet = (value: string): Set<string> => {
  return new Set(tokenizeForCoverage(value));
};

const matchesContextToken = (
  questionToken: string,
  contextToken: string
): boolean => {
  if (questionToken === contextToken) {
    return true;
  }

  if (questionToken.length < 4 || contextToken.length < 4) {
    return false;
  }

  return (
    questionToken.startsWith(contextToken) ||
    contextToken.startsWith(questionToken)
  );
};

const getMatchedTokenCount = (
  tokens: string[],
  haystackTokens: Set<string>
): number => {
  return tokens.filter((token) =>
    Array.from(haystackTokens).some((haystackToken) =>
      matchesContextToken(token, haystackToken)
    )
  ).length;
};

const getContextQueryRelevance = (
  question: string,
  context: GroundingContext
): number => {
  const questionTokens = Array.from(new Set(tokenizeForCoverage(question)));

  if (questionTokens.length === 0) {
    return 0.5;
  }

  const title = context.asset.title.toLowerCase();
  const content = context.text.toLowerCase();
  const combined = `${title}\n${content}`;
  const matchedTokens = getMatchedTokenCount(
    questionTokens,
    buildTokenSet(combined)
  );
  const matchedTitleTokens = getMatchedTokenCount(
    questionTokens,
    buildTokenSet(title)
  );
  const exactQueryBonus = combined.includes(question.trim().toLowerCase())
    ? 0.1
    : 0;

  return clamp(
    0.08 +
      (matchedTokens / questionTokens.length) * 0.58 +
      (matchedTitleTokens / questionTokens.length) * 0.24 +
      exactQueryBonus,
    0,
    1
  );
};

const getContextSelectionScore = (
  question: string,
  context: GroundingContext
): number => {
  return (
    context.score +
    getContextQueryRelevance(question, context) * 0.45 +
    SOURCE_TYPE_PRIORITY[context.layer] * 0.01
  );
};

const getContextCoverage = (
  question: string,
  contexts: GroundingContext[]
): number => {
  const questionTokens = Array.from(new Set(tokenizeForCoverage(question)));

  if (questionTokens.length === 0) {
    return 1;
  }

  const contextTokens = new Set(
    contexts.flatMap((context) =>
      tokenizeForCoverage(`${context.asset.title} ${context.text}`)
    )
  );
  const coveredTokenCount = questionTokens.filter((token) =>
    Array.from(contextTokens).some((contextToken) =>
      matchesContextToken(token, contextToken)
    )
  ).length;

  return coveredTokenCount / questionTokens.length;
};

const shouldRejectContextAnswer = (
  question: string,
  contexts: GroundingContext[],
  contextPolicy: ContextRetrievalPolicy | undefined
): boolean => {
  if (!contextPolicy) {
    return false;
  }

  if (contexts.length === 0) {
    return true;
  }

  const topScore = contexts[0]?.score ?? 0;
  const coverage = getContextCoverage(question, contexts);
  const topRelevance = contexts[0]
    ? getContextQueryRelevance(question, contexts[0])
    : 0;
  const relevantContextCount = contexts.filter(
    (context) => getContextQueryRelevance(question, context) >= 0.28
  ).length;

  if (relevantContextCount >= MIN_CONTEXT_COUNT && coverage >= 0.15) {
    return false;
  }

  if (topScore >= MIN_CONTEXT_SCORE && coverage >= MIN_CONTEXT_COVERAGE) {
    return false;
  }

  if (topScore >= 0.75 && topRelevance >= 0.45) {
    return false;
  }

  if (contexts.length === 1 && topScore >= 0.72 && topRelevance >= 0.55) {
    return false;
  }

  return true;
};

const getSummaryGroundingContexts = async (
  repository: AssetSearchRepository,
  question: string,
  limit: number,
  contextPolicy?: ContextRetrievalPolicy
): Promise<GroundingContext[]> => {
  if (contextPolicy && !contextPolicy.includeSummaryOnly) {
    return [];
  }

  const summaryMatches = await repository
    .searchAssetSummaries({
      query: question,
      limit,
      aiVisibility: [...CHAT_SUMMARY_ONLY_AI_VISIBILITY],
    })
    .catch(() => []);

  return buildSummaryGroundingContexts(question, summaryMatches)
    .map((context) => ({
      ...context,
      score: applyContextPolicyScore(
        context.score,
        context.asset,
        contextPolicy
      ),
    }))
    .map((context) =>
      annotateEvidenceMatchReasons(context, {
        profileBoosted: isProfileBoosted(context, contextPolicy),
      })
    )
    .filter((context) =>
      matchesContextPolicyAsset(context.asset, contextPolicy)
    );
};

const getAssertionGroundingContexts = async (
  repository: AssetSearchRepository,
  question: string,
  limit: number,
  contextPolicy?: ContextRetrievalPolicy
): Promise<GroundingContext[]> => {
  if (!repository.searchAssetAssertions) {
    return [];
  }

  const assertionMatches = await repository
    .searchAssetAssertions({
      query: question,
      limit,
      aiVisibility: [
        ...CHAT_SUMMARY_ONLY_AI_VISIBILITY,
        ...CHAT_ALLOWED_AI_VISIBILITY,
      ],
    })
    .catch(() => []);

  return assertionMatches
    .map((match) =>
      buildAssertionEvidenceItem(
        match,
        applyContextPolicyScore(
          scoreAssetAssertionMatch(question, match),
          match.asset,
          contextPolicy
        )
      )
    )
    .map((context) =>
      annotateEvidenceMatchReasons(context, {
        profileBoosted: isProfileBoosted(context, contextPolicy),
      })
    )
    .filter((context) =>
      matchesContextPolicyAsset(context.asset, contextPolicy)
    )
    .sort((left, right) => right.score - left.score);
};

const buildGroundingContexts = (
  vectorMatches: Awaited<ReturnType<VectorStore["search"]>>,
  chunkMatches: Awaited<
    ReturnType<AssetSearchRepository["getChunkMatchesByVectorIds"]>
  >
): GroundingContext[] => {
  const chunkMatchMap = new Map(
    chunkMatches
      .filter((match) => match.vectorId)
      .map((match) => [match.vectorId as string, match])
  );

  return vectorMatches.reduce<GroundingContext[]>((contexts, match) => {
    const chunkMatch = chunkMatchMap.get(match.id);

    if (!chunkMatch) {
      return contexts;
    }

    contexts.push(buildChunkEvidenceItem(chunkMatch, match.score));

    return contexts;
  }, []);
};

const buildSummaryGroundingContexts = (
  question: string,
  summaryMatches: Awaited<
    ReturnType<AssetSearchRepository["searchAssetSummaries"]>
  >
): GroundingContext[] => {
  return summaryMatches
    .map((match) =>
      buildSummaryEvidenceItem(match, scoreAssetSummaryMatch(question, match))
    )
    .sort((left, right) => right.score - left.score);
};

const buildChatPrompt = (
  question: string,
  contexts: GroundingContext[]
): string => {
  const promptSources = contexts.map((context) => ({
    ...buildChatSource(context),
    snippet: context.text,
  }));

  return buildPrompt(question, promptSources);
};

const compareGroundingContexts = (
  question: string,
  left: GroundingContext,
  right: GroundingContext
): number => {
  const rightSelectionScore = getContextSelectionScore(question, right);
  const leftSelectionScore = getContextSelectionScore(question, left);

  if (rightSelectionScore !== leftSelectionScore) {
    return rightSelectionScore - leftSelectionScore;
  }

  return SOURCE_TYPE_PRIORITY[right.layer] - SOURCE_TYPE_PRIORITY[left.layer];
};

const normalizeComparableText = (value: string): string => {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
};

const stripEchoedSourceBlocks = (text: string): string => {
  const lines = text.split("\n");
  const keptLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const trimmedLine = lines[index]?.trim() ?? "";
    const nextLine = lines[index + 1]?.trim() ?? "";
    const isSourceLabelLine = /^\[S\d+\]\s+/.test(trimmedLine);
    const isSourceMetadataLine =
      /^Asset ID:/i.test(trimmedLine) ||
      /^Source Type:/i.test(trimmedLine) ||
      /^Source URL:/i.test(trimmedLine) ||
      /^Snippet:/i.test(trimmedLine);

    if (/^Sources:\s*$/i.test(trimmedLine)) {
      while (index + 1 < lines.length) {
        const lookahead = lines[index + 1]?.trim() ?? "";

        if (
          lookahead.length === 0 ||
          /^\[S\d+\]\s+/.test(lookahead) ||
          /^Asset ID:/i.test(lookahead) ||
          /^Source Type:/i.test(lookahead) ||
          /^Source URL:/i.test(lookahead) ||
          /^Snippet:/i.test(lookahead)
        ) {
          index += 1;
          continue;
        }

        break;
      }

      continue;
    }

    if (isSourceLabelLine && /^Asset ID:/i.test(nextLine)) {
      while (index + 1 < lines.length) {
        const lookahead = lines[index + 1]?.trim() ?? "";

        if (
          lookahead.length === 0 ||
          /^\[S\d+\]\s+/.test(lookahead) ||
          /^Asset ID:/i.test(lookahead) ||
          /^Source Type:/i.test(lookahead) ||
          /^Source URL:/i.test(lookahead) ||
          /^Snippet:/i.test(lookahead)
        ) {
          index += 1;
          continue;
        }

        break;
      }

      continue;
    }

    if (isSourceMetadataLine) {
      continue;
    }

    keptLines.push(lines[index] as string);
  }

  return keptLines.join("\n");
};

const dedupeRepeatedSentences = (text: string): string => {
  const paragraphs = text
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
  const seenParagraphs = new Set<string>();
  const dedupedParagraphs = paragraphs.reduce<string[]>((result, paragraph) => {
    const sentences = paragraph
      .split(/(?<=[.!?。！？])\s+/g)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);
    const seenSentences = new Set<string>();
    const dedupedSentences = sentences.filter((sentence) => {
      const normalizedSentence = normalizeComparableText(sentence);

      if (!normalizedSentence || seenSentences.has(normalizedSentence)) {
        return false;
      }

      seenSentences.add(normalizedSentence);

      return true;
    });
    const normalizedParagraph = normalizeComparableText(
      dedupedSentences.join(" ")
    );

    if (!normalizedParagraph || seenParagraphs.has(normalizedParagraph)) {
      return result;
    }

    seenParagraphs.add(normalizedParagraph);
    result.push(dedupedSentences.join(" "));

    return result;
  }, []);

  return dedupedParagraphs.join("\n\n");
};

const dedupeRepeatedPlainSentences = (value: string): string => {
  const sentences = value
    .split(/(?<=[.!?。！？])\s+/g)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  if (sentences.length <= 1) {
    return value.trim();
  }

  const seenSentences = new Set<string>();

  return sentences
    .filter((sentence) => {
      const normalizedSentence = normalizeComparableText(sentence);

      if (!normalizedSentence || seenSentences.has(normalizedSentence)) {
        return false;
      }

      seenSentences.add(normalizedSentence);

      return true;
    })
    .join(" ");
};

const dedupeRepeatedContent = (text: string): string => {
  const blocks = text
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
  const seenBlocks = new Set<string>();

  return blocks
    .reduce<string[]>((result, block) => {
      const lines = block
        .split("\n")
        .map((line) => line.trimEnd())
        .filter((line, index, source) => {
          const normalizedLine = normalizeComparableText(line);
          const previousLine = source[index - 1];

          if (!normalizedLine) {
            return true;
          }

          return normalizedLine !== normalizeComparableText(previousLine ?? "");
        });
      const blockText = lines.join("\n").trim();
      const normalizedBlock = normalizeComparableText(blockText);

      if (!normalizedBlock || seenBlocks.has(normalizedBlock)) {
        return result;
      }

      seenBlocks.add(normalizedBlock);

      if (lines.length === 1 && !/^[-*>\d.]/.test(lines[0] ?? "")) {
        result.push(
          dedupeRepeatedPlainSentences(dedupeRepeatedSentences(blockText))
        );

        return result;
      }

      result.push(blockText);

      return result;
    }, [])
    .join("\n\n");
};

const sanitizeAnswerText = (text: string): string => {
  return dedupeRepeatedContent(stripEchoedSourceBlocks(text))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const INVALID_REFERENCE_PATTERNS = [
  /\bthe same as v\d+\b/i,
  /\bsame as above\b/i,
  /\bsame as previous\b/i,
  /\bsame answer\b/i,
];

const INSUFFICIENT_ANSWER_PATTERNS = [
  /not enough relevant context/i,
  /could not find enough relevant context/i,
  /sources are insufficient/i,
  /insufficient context/i,
];

const isLowQualityAnswer = (text: string): boolean => {
  const normalized = text.trim();

  if (!normalized) {
    return true;
  }

  return INVALID_REFERENCE_PATTERNS.some((pattern) => pattern.test(normalized));
};

const isInsufficientAnswer = (text: string): boolean => {
  return INSUFFICIENT_ANSWER_PATTERNS.some((pattern) => pattern.test(text));
};

const hasStrongAnswerEvidence = (
  question: string,
  contexts: GroundingContext[]
): boolean => {
  if (contexts.length === 0) {
    return false;
  }

  const topContext = contexts[0];
  const topScore = topContext?.score ?? 0;
  const topRelevance = topContext
    ? getContextQueryRelevance(question, topContext)
    : 0;
  const coverage = getContextCoverage(question, contexts);

  return (
    (topScore >= 0.8 && topRelevance >= 0.38) ||
    (topScore >= 0.72 && topRelevance >= 0.5) ||
    coverage >= 0.22
  );
};

const buildExtractiveFallbackAnswer = (
  contexts: GroundingContext[]
): string => {
  const primaryContext = contexts[0];

  if (!primaryContext) {
    return createFallbackAnswer();
  }

  const excerpt = primaryContext.text
    .replace(/\s+/g, " ")
    .replace(/\[(S\d+)\]/g, "$1")
    .trim()
    .slice(0, 240)
    .trim();

  if (!excerpt) {
    return createFallbackAnswer();
  }

  const normalizedExcerpt = /[.!?。！？]$/.test(excerpt)
    ? excerpt
    : `${excerpt}.`;

  return `${normalizedExcerpt} [S1]`;
};

const selectGroundingContexts = (
  question: string,
  contexts: GroundingContext[],
  topK: number,
  options?: {
    allowLowRelevanceSecondary?: boolean;
  }
): GroundingContext[] => {
  const groupedContexts = buildGroupedEvidence(contexts)
    .map((group) => ({
      ...group,
      assetScore:
        group.assetScore +
        getContextQueryRelevance(question, group.primaryEvidence) * 0.18,
      items: [...group.items].sort((left, right) =>
        compareGroundingContexts(question, left, right)
      ),
      primaryEvidence: [...group.items].sort((left, right) =>
        compareGroundingContexts(question, left, right)
      )[0] as GroundingContext,
    }))
    .sort((left, right) => {
      if (right.assetScore !== left.assetScore) {
        return right.assetScore - left.assetScore;
      }

      return compareGroundingContexts(
        question,
        left.primaryEvidence,
        right.primaryEvidence
      );
    });
  const sortedContexts = flattenGroupedEvidence(groupedContexts);
  const selected: GroundingContext[] = [];
  const seenContentKeys = new Set<string>();
  const topSelectionScore = sortedContexts[0]
    ? getContextSelectionScore(question, sortedContexts[0])
    : 0;

  for (const context of sortedContexts) {
    if (selected.length >= topK) {
      break;
    }

    if (
      selected.length > 0 &&
      topSelectionScore > 0 &&
      getContextSelectionScore(question, context) / topSelectionScore <
        MIN_RELATIVE_CONTEXT_SCORE_RATIO
    ) {
      continue;
    }

    const existingForAsset = selected.filter(
      (selectedContext) => selectedContext.asset.id === context.asset.id
    );
    const strongestAssetScore = existingForAsset[0]?.score ?? 0;

    if (
      existingForAsset.length > 0 &&
      strongestAssetScore > 0 &&
      context.score / strongestAssetScore < MIN_SECONDARY_ASSET_SCORE_RATIO
    ) {
      continue;
    }

    if (existingForAsset.length >= MAX_CONTEXTS_PER_ASSET) {
      continue;
    }

    if (
      selected.length > 0 &&
      existingForAsset.length === 0 &&
      !options?.allowLowRelevanceSecondary &&
      getContextQueryRelevance(question, context) <
        MIN_SECONDARY_CONTEXT_RELEVANCE
    ) {
      continue;
    }

    if (
      existingForAsset.some(
        (selectedContext) =>
          selectedContext.layer === "chunk" && context.layer !== "chunk"
      )
    ) {
      continue;
    }

    if (
      existingForAsset.some(
        (selectedContext) =>
          selectedContext.layer === "assertion" && context.layer === "summary"
      )
    ) {
      continue;
    }

    const contentKey = [
      context.asset.id,
      context.layer,
      normalizeComparableText(context.text).slice(0, 240),
    ].join(":");

    if (seenContentKeys.has(contentKey)) {
      continue;
    }

    seenContentKeys.add(contentKey);
    selected.push(context);
  }

  return selected;
};

const generateGroundedAnswer = async (
  aiProvider: AIProvider,
  question: string,
  contexts: GroundingContext[]
): Promise<string> => {
  const prompt = buildChatPrompt(question, contexts);
  const initialAnswer = await aiProvider.generateText({
    systemPrompt: BASE_CHAT_SYSTEM_PROMPT,
    prompt,
    temperature: 0.2,
    maxOutputTokens: 700,
  });
  const sanitizedInitialAnswer = sanitizeAnswerText(initialAnswer.text);

  if (
    !isLowQualityAnswer(sanitizedInitialAnswer) &&
    !(
      isInsufficientAnswer(sanitizedInitialAnswer) &&
      hasStrongAnswerEvidence(question, contexts)
    )
  ) {
    return sanitizedInitialAnswer;
  }

  const retryAnswer = await aiProvider.generateText({
    systemPrompt: RETRY_CHAT_SYSTEM_PROMPT,
    prompt,
    temperature: 0.1,
    maxOutputTokens: 700,
  });
  const sanitizedRetryAnswer = sanitizeAnswerText(retryAnswer.text);

  if (
    sanitizedRetryAnswer.length > 0 &&
    !isLowQualityAnswer(sanitizedRetryAnswer) &&
    !(
      isInsufficientAnswer(sanitizedRetryAnswer) &&
      hasStrongAnswerEvidence(question, contexts)
    )
  ) {
    return sanitizedRetryAnswer;
  }

  if (hasStrongAnswerEvidence(question, contexts)) {
    return buildExtractiveFallbackAnswer(contexts);
  }

  return sanitizedRetryAnswer;
};

const withOptionalResultScope = <T extends AskLibraryResult>(
  result: T,
  scope: AskLibraryResult["resultScope"]
): T => {
  if (!scope) {
    return result;
  }

  return {
    ...result,
    resultScope: scope,
  };
};

// 这里实现最小问答链路：query embedding -> Vectorize 召回 -> D1 回填 -> AI 生成答案。
export const createChatService = (
  dependencies: ChatServiceDependencies = defaultDependencies
) => {
  const executeAskLibrary = async (
    bindings: AppBindings | undefined,
    input: AskLibraryInput,
    contextPolicy?: ContextRetrievalPolicy
  ): Promise<AskLibraryResult> => {
    const question = input.question.trim();

    if (!question) {
      throw new Error("Question is required.");
    }

    const topK = input.topK ?? 5;
    const overfetchMultiplier = Math.max(
      contextPolicy?.overfetchMultiplier ?? 1,
      1
    );
    const retrievalLimit = topK * overfetchMultiplier;
    const [repository, vectorStore, aiProvider] = await Promise.all([
      dependencies.getAssetRepository(bindings),
      dependencies.getVectorStore(bindings),
      dependencies.getAiProvider(bindings),
    ]);
    const embeddingResult = await aiProvider.createEmbeddings({
      texts: [question],
      purpose: "query",
    });
    const queryVector = embeddingResult.embeddings[0];
    const summaryContexts = await getSummaryGroundingContexts(
      repository,
      question,
      retrievalLimit,
      contextPolicy
    );
    const assertionContexts = await getAssertionGroundingContexts(
      repository,
      question,
      retrievalLimit,
      contextPolicy
    );

    if (!queryVector) {
      const lexicalContexts = [...assertionContexts, ...summaryContexts].sort(
        (left, right) => compareGroundingContexts(question, left, right)
      );
      const selectedLexicalContexts = selectGroundingContexts(
        question,
        lexicalContexts,
        topK,
        {
          allowLowRelevanceSecondary: Boolean(contextPolicy?.allowFallback),
        }
      );

      if (selectedLexicalContexts.length === 0) {
        return withOptionalResultScope(
          {
            answer: createFallbackAnswer(),
            sources: [],
            evidence: buildEvidencePacket([]),
            groupedEvidence: [],
          },
          getContextResultScope([], contextPolicy)
        );
      }

      const resultScope = getContextResultScope(
        selectedLexicalContexts.map((context) => context.asset),
        contextPolicy
      );

      if (
        shouldRejectContextAnswer(
          question,
          selectedLexicalContexts,
          contextPolicy
        )
      ) {
        return withOptionalResultScope(
          {
            answer: createFallbackAnswer(),
            sources: [],
            evidence: buildEvidencePacket([]),
            groupedEvidence: [],
          },
          resultScope
        );
      }

      const sanitizedAnswer = await generateGroundedAnswer(
        aiProvider,
        question,
        selectedLexicalContexts
      );

      return withOptionalResultScope(
        {
          answer:
            sanitizedAnswer.length > 0
              ? sanitizedAnswer
              : createFallbackAnswer(),
          sources: selectedLexicalContexts.map(buildChatSource),
          evidence: buildEvidencePacket(selectedLexicalContexts),
          groupedEvidence: buildGroupedEvidence(selectedLexicalContexts),
          indexingSummary: buildIndexingSummary(selectedLexicalContexts),
        },
        resultScope
      );
    }

    const vectorMatches = await vectorStore.search({
      values: queryVector,
      topK: retrievalLimit,
    });

    const chunkMatches =
      vectorMatches.length > 0
        ? await repository.getChunkMatchesByVectorIds(
            vectorMatches.map((match) => match.id),
            {
              aiVisibility: [...CHAT_ALLOWED_AI_VISIBILITY],
            }
          )
        : [];
    const groundingContexts = buildGroundingContexts(
      vectorMatches,
      chunkMatches
    )
      .map((context) => ({
        ...context,
        score: applyContextPolicyScore(
          context.score,
          context.asset,
          contextPolicy
        ),
      }))
      .map((context) =>
        annotateEvidenceMatchReasons(context, {
          profileBoosted: isProfileBoosted(context, contextPolicy),
        })
      )
      .filter((context) =>
        matchesContextPolicyAsset(context.asset, contextPolicy)
      );
    const allGroundingContexts = [
      ...groundingContexts,
      ...assertionContexts,
      ...summaryContexts,
    ].sort((left, right) => compareGroundingContexts(question, left, right));
    const selectedGroundingContexts = selectGroundingContexts(
      question,
      allGroundingContexts,
      topK,
      {
        allowLowRelevanceSecondary: Boolean(contextPolicy?.allowFallback),
      }
    );
    const resultScope = getContextResultScope(
      selectedGroundingContexts.map((context) => context.asset),
      contextPolicy
    );

    if (selectedGroundingContexts.length === 0) {
      return withOptionalResultScope(
        {
          answer: createFallbackAnswer(),
          sources: [],
          evidence: buildEvidencePacket([]),
          groupedEvidence: [],
        },
        resultScope
      );
    }

    if (
      shouldRejectContextAnswer(
        question,
        selectedGroundingContexts,
        contextPolicy
      )
    ) {
      return withOptionalResultScope(
        {
          answer: createFallbackAnswer(),
          sources: [],
          evidence: buildEvidencePacket([]),
          groupedEvidence: [],
        },
        resultScope
      );
    }

    const sanitizedAnswer = await generateGroundedAnswer(
      aiProvider,
      question,
      selectedGroundingContexts
    );

    return withOptionalResultScope(
      {
        answer:
          sanitizedAnswer.length > 0 ? sanitizedAnswer : createFallbackAnswer(),
        sources: selectedGroundingContexts.map(buildChatSource),
        evidence: buildEvidencePacket(selectedGroundingContexts),
        groupedEvidence: buildGroupedEvidence(selectedGroundingContexts),
        indexingSummary: buildIndexingSummary(selectedGroundingContexts),
      },
      resultScope
    );
  };

  return {
    async askLibrary(
      bindings: AppBindings | undefined,
      input: AskLibraryInput
    ): Promise<AskLibraryResult> {
      return executeAskLibrary(bindings, input);
    },

    async askLibraryForContext(
      bindings: AppBindings | undefined,
      input: AskLibraryInput,
      contextPolicy: ContextRetrievalPolicy
    ): Promise<AskLibraryResult> {
      return executeAskLibrary(bindings, input, contextPolicy);
    },
  };
};

const chatService = createChatService();

export const { askLibrary, askLibraryForContext } = chatService;
