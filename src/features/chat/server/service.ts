import type { AIProvider } from "@/core/ai/ports";
import type {
  AssetSearchInput,
  AssetSearchRepository,
} from "@/core/assets/ports";
import { createLogger } from "@/core/logging/logger";
import { normalizeRecordFilters } from "@/core/records/filters";
import { tokenizeMixedText } from "@/core/text/tokenize";
import type { VectorStore } from "@/core/vector/ports";
import type { AppBindings } from "@/env";
import type { ContextRetrievalPolicy } from "@/features/mcp/server/context-profiles";
import type { EvidenceItem } from "@/features/search/model/evidence";
import type { SearchResult } from "@/features/search/model/types";
import {
  buildEvidencePacket,
  buildGroupedEvidence,
} from "@/features/search/server/evidence";
import {
  createSearchService,
  searchAssets,
  searchAssetsForContext,
} from "@/features/search/server/service";
import { getAIProviderFromBindings } from "@/platform/ai/workers-ai/get-ai-provider";
import { getAssetSearchRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";
import { getVectorStoreFromBindings } from "@/platform/vector/vectorize/get-vector-store";
import type {
  AskLibraryIndexingSummary,
  AskLibraryInput,
  AskLibraryResult,
  ChatSource,
} from "../model/types";
import { type GroundingContext, SOURCE_TYPE_PRIORITY } from "./grounding";
import { chatPromptRegistry } from "./prompts";

interface ChatRetrievalService {
  searchAssets(
    bindings: AppBindings | undefined,
    input: AssetSearchInput
  ): Promise<SearchResult>;
  searchAssetsForContext(
    bindings: AppBindings | undefined,
    input: AssetSearchInput,
    contextPolicy: ContextRetrievalPolicy
  ): Promise<SearchResult>;
}

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
  getRetrievalService?: (() => ChatRetrievalService) | undefined;
}

const defaultDependencies: ChatServiceDependencies = {
  getAssetRepository: getAssetSearchRepositoryFromBindings,
  getVectorStore: getVectorStoreFromBindings,
  getAiProvider: getAIProviderFromBindings,
  getRetrievalService: () => ({ searchAssets, searchAssetsForContext }),
};
const chatLogger = createLogger("chat");

const createFallbackAnswer = (): string => {
  return (
    "I could not find enough relevant context in your library to answer " +
    "that yet."
  );
};

const MIN_RELATIVE_CONTEXT_SCORE_RATIO = 0.42;
const MIN_SECONDARY_ASSET_SCORE_RATIO = 0.65;
const MAX_CONTEXTS_PER_ASSET = 2;
const MIN_SECONDARY_CONTEXT_RELEVANCE = 0.22;

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
    documentClasses: [],
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
    topics: [],
  };
};

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
  return tokenizeMixedText(value, { stopWords: CONTEXT_STOP_WORDS });
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
    context.score * 0.3 +
    getContextQueryRelevance(question, context) * 0.7 +
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
  const hasRelevantSummaryOnlyContext = contexts.some(
    (context) =>
      context.layer === "summary" &&
      context.asset.aiVisibility === "summary_only" &&
      getContextQueryRelevance(question, context) >= 0.45 &&
      getContextCoverage(question, [context]) >= MIN_CONTEXT_COVERAGE
  );

  if (hasRelevantSummaryOnlyContext) {
    return false;
  }

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
  groups: SearchResult["groupedEvidence"],
  topK: number,
  options?: {
    allowLowRelevanceSecondary?: boolean;
  }
): GroundingContext[] => {
  const answerCandidates = groups.flatMap((group) => {
    const chunkItems = group.items.filter((item) => item.layer === "chunk");

    return chunkItems.length > 0 ? chunkItems : group.items;
  });
  const sortedContexts = answerCandidates.sort((left, right) => {
    const scoreDifference =
      getContextSelectionScore(question, right) -
      getContextSelectionScore(question, left);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return SOURCE_TYPE_PRIORITY[right.layer] - SOURCE_TYPE_PRIORITY[left.layer];
  });
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
      !options?.allowLowRelevanceSecondary &&
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
  const promptSources = contexts.map((context) => ({
    ...buildChatSource(context),
    snippet: context.text,
  }));
  const promptTemplate = chatPromptRegistry.get("rag-user").build({
    question,
    sources: promptSources,
  });
  const initialAnswer = await aiProvider.generateText({
    systemPrompt: chatPromptRegistry
      .get("rag-system")
      .build({ variant: "base" }).systemPrompt,
    prompt: promptTemplate.prompt,
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
    systemPrompt: chatPromptRegistry.get("rag-system").build({
      variant: "retry",
    }).systemPrompt,
    prompt: promptTemplate.prompt,
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

const logAskCompleted = (
  startedAt: number,
  question: string,
  topK: number,
  retrievalLimit: number,
  contextPolicy: ContextRetrievalPolicy | undefined,
  result: AskLibraryResult,
  fields?: Record<string, unknown>
): AskLibraryResult => {
  chatLogger.info("ask_completed", {
    durationMs: Date.now() - startedAt,
    questionLength: question.length,
    topK,
    retrievalLimit,
    sourceCount: result.sources.length,
    groupedEvidenceCount: result.groupedEvidence.length,
    resultScope: result.resultScope ?? null,
    contextProfile: contextPolicy?.profile ?? null,
    allowFallback: contextPolicy?.allowFallback ?? false,
    answered: result.answer !== createFallbackAnswer(),
    ...fields,
  });

  return result;
};

// 问答复用搜索主干的混合召回与排序，只在这里处理证据门槛和答案生成。
export const createChatService = (
  dependencies: ChatServiceDependencies = defaultDependencies
) => {
  const retrievalService =
    dependencies.getRetrievalService?.() ??
    createSearchService({
      getAssetRepository: dependencies.getAssetRepository,
      getVectorStore: dependencies.getVectorStore,
      getAIProvider: dependencies.getAiProvider,
    });

  const executeAskLibrary = async (
    bindings: AppBindings | undefined,
    input: AskLibraryInput,
    contextPolicy?: ContextRetrievalPolicy
  ): Promise<AskLibraryResult> => {
    const startedAt = Date.now();
    const question = input.question.trim();
    const appliedRecordFilters = normalizeRecordFilters(input);

    if (!question) {
      throw new Error("Question is required.");
    }

    const topK = input.topK ?? 5;
    const overfetchMultiplier = Math.max(
      contextPolicy?.overfetchMultiplier ?? 1,
      1
    );
    const retrievalLimit = topK * overfetchMultiplier;
    try {
      const searchInput: AssetSearchInput = {
        query: question,
        page: 1,
        pageSize: topK,
        ...appliedRecordFilters,
      };
      const [searchResult, aiProvider] = await Promise.all([
        contextPolicy
          ? retrievalService.searchAssetsForContext(
              bindings,
              searchInput,
              contextPolicy
            )
          : retrievalService.searchAssets(bindings, searchInput),
        dependencies.getAiProvider(bindings),
      ]);
      const selectedGroundingContexts = selectGroundingContexts(
        question,
        searchResult.groupedEvidence,
        topK,
        {
          allowLowRelevanceSecondary: Boolean(contextPolicy?.allowFallback),
        }
      );
      const resultScope = searchResult.resultScope;

      if (selectedGroundingContexts.length === 0) {
        return logAskCompleted(
          startedAt,
          question,
          topK,
          retrievalLimit,
          contextPolicy,
          withOptionalResultScope(
            {
              answer: createFallbackAnswer(),
              sources: [],
              evidence: buildEvidencePacket([]),
              groupedEvidence: [],
            },
            resultScope
          ),
          {
            selectedContextCount: 0,
            answerMode: "no_context",
          }
        );
      }

      if (
        shouldRejectContextAnswer(
          question,
          selectedGroundingContexts,
          contextPolicy
        )
      ) {
        return logAskCompleted(
          startedAt,
          question,
          topK,
          retrievalLimit,
          contextPolicy,
          withOptionalResultScope(
            {
              answer: createFallbackAnswer(),
              sources: [],
              evidence: buildEvidencePacket([]),
              groupedEvidence: [],
            },
            resultScope
          ),
          {
            selectedContextCount: selectedGroundingContexts.length,
            answerMode: "rejected_context",
          }
        );
      }

      const sanitizedAnswer = await generateGroundedAnswer(
        aiProvider,
        question,
        selectedGroundingContexts
      );

      return logAskCompleted(
        startedAt,
        question,
        topK,
        retrievalLimit,
        contextPolicy,
        withOptionalResultScope(
          {
            answer:
              sanitizedAnswer.length > 0
                ? sanitizedAnswer
                : createFallbackAnswer(),
            sources: selectedGroundingContexts.map(buildChatSource),
            evidence: buildEvidencePacket(selectedGroundingContexts),
            groupedEvidence: buildGroupedEvidence(selectedGroundingContexts),
            indexingSummary: buildIndexingSummary(selectedGroundingContexts),
          },
          resultScope
        ),
        {
          selectedContextCount: selectedGroundingContexts.length,
          answerMode:
            sanitizedAnswer.length > 0 ? "grounded_answer" : "fallback",
        }
      );
    } catch (error) {
      chatLogger.error(
        "ask_failed",
        {
          durationMs: Date.now() - startedAt,
          questionLength: question.length,
          topK,
          retrievalLimit,
          contextProfile: contextPolicy?.profile ?? null,
          allowFallback: contextPolicy?.allowFallback ?? false,
        },
        { error }
      );

      throw error;
    }
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
