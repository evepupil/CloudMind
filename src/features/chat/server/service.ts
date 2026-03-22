import type { AIProvider } from "@/core/ai/ports";
import type { AssetSearchRepository } from "@/core/assets/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { AppBindings } from "@/env";
import type { AssetSummary } from "@/features/assets/model/types";
import type { ContextRetrievalPolicy } from "@/features/mcp/server/context-profiles";
import { scoreAssetAssertionMatch } from "@/features/search/server/assertion-scoring";
import {
  applyContextPolicyScore,
  getContextResultScope,
  matchesContextPolicyAsset,
} from "@/features/search/server/context-policy";
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
const SOURCE_TYPE_PRIORITY: Record<ChatSource["sourceType"], number> = {
  chunk: 3,
  assertion: 2,
  summary: 1,
};
const MIN_RELATIVE_CONTEXT_SCORE_RATIO = 0.35;
const MIN_SECONDARY_ASSET_SCORE_RATIO = 0.65;
const MAX_CONTEXTS_PER_ASSET = 2;

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

const parseDescriptorTopics = (descriptorJson: string | null): string[] => {
  if (!descriptorJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(descriptorJson) as DescriptorTopicsView | null;

    if (!parsed || !Array.isArray(parsed.topics)) {
      return [];
    }

    return parsed.topics.filter(
      (topic: unknown): topic is string => typeof topic === "string"
    );
  } catch {
    return [];
  }
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

const buildIndexingSummary = (
  contexts: GroundingContext[]
): AskLibraryIndexingSummary => {
  return {
    matchedLayers: collectUniqueLimited(
      contexts.map((context) => context.source.sourceType),
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
      contexts.flatMap((context) =>
        parseDescriptorTopics(context.asset.descriptorJson)
      ),
      6
    ),
  };
};

interface GroundingContext {
  score: number;
  source: ChatSource;
  contentText: string;
  asset: AssetSummary;
}

interface DescriptorTopicsView {
  topics?: string[] | undefined;
}

const MIN_CONTEXT_TOKEN_LENGTH = 4;
const MIN_CONTEXT_COVERAGE = 0.2;
const MIN_CONTEXT_SCORE = 0.85;
const MIN_CONTEXT_COUNT = 2;
const CONTEXT_STOP_WORDS = new Set([
  "about",
  "based",
  "does",
  "from",
  "have",
  "into",
  "that",
  "this",
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

const getContextCoverage = (
  question: string,
  contexts: GroundingContext[]
): number => {
  const questionTokens = Array.from(new Set(tokenizeForCoverage(question)));

  if (questionTokens.length === 0) {
    return 1;
  }

  const contextText = contexts
    .map((context) => `${context.source.title} ${context.contentText}`)
    .join(" ")
    .toLowerCase();
  const coveredTokenCount = questionTokens.filter((token) =>
    contextText.includes(token)
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

  if (
    contexts.length >= MIN_CONTEXT_COUNT &&
    coverage >= MIN_CONTEXT_COVERAGE
  ) {
    return false;
  }

  if (topScore >= MIN_CONTEXT_SCORE && coverage >= MIN_CONTEXT_COVERAGE) {
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

  const summaryMatches = await repository.searchAssetSummaries({
    query: question,
    limit,
    aiVisibility: [...CHAT_SUMMARY_ONLY_AI_VISIBILITY],
  });

  return buildSummaryGroundingContexts(question, summaryMatches)
    .map((context) => ({
      ...context,
      score: applyContextPolicyScore(
        context.score,
        context.asset,
        contextPolicy
      ),
    }))
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

  const assertionMatches = await repository.searchAssetAssertions({
    query: question,
    limit,
    aiVisibility: [
      ...CHAT_SUMMARY_ONLY_AI_VISIBILITY,
      ...CHAT_ALLOWED_AI_VISIBILITY,
    ],
  });

  return assertionMatches
    .map((match) => ({
      score: applyContextPolicyScore(
        scoreAssetAssertionMatch(question, match),
        match.asset,
        contextPolicy
      ),
      source: {
        sourceType: "assertion" as const,
        assetId: match.asset.id,
        title: match.asset.title,
        sourceUrl: match.asset.sourceUrl,
        snippet: match.text,
      },
      contentText: match.text,
      asset: match.asset,
    }))
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

    contexts.push({
      source: {
        sourceType: "chunk",
        assetId: chunkMatch.asset.id,
        chunkId: chunkMatch.id,
        title: chunkMatch.asset.title,
        sourceUrl: chunkMatch.asset.sourceUrl,
        snippet: chunkMatch.textPreview,
      },
      score: match.score,
      contentText: chunkMatch.contentText?.trim() || chunkMatch.textPreview,
      asset: chunkMatch.asset,
    });

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
    .map((match) => ({
      score: scoreAssetSummaryMatch(question, match),
      source: {
        sourceType: "summary" as const,
        assetId: match.asset.id,
        title: match.asset.title,
        sourceUrl: match.asset.sourceUrl,
        snippet: match.summary,
      },
      contentText: match.summary,
      asset: match.asset,
    }))
    .sort((left, right) => right.score - left.score);
};

const buildChatPrompt = (
  question: string,
  contexts: GroundingContext[]
): string => {
  const promptSources = contexts.map((context) => ({
    ...context.source,
    snippet: context.contentText,
  }));

  return buildPrompt(question, promptSources);
};

const compareGroundingContexts = (
  left: GroundingContext,
  right: GroundingContext
): number => {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return (
    SOURCE_TYPE_PRIORITY[right.source.sourceType] -
    SOURCE_TYPE_PRIORITY[left.source.sourceType]
  );
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

const sanitizeAnswerText = (text: string): string => {
  return dedupeRepeatedSentences(stripEchoedSourceBlocks(text))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const selectGroundingContexts = (
  contexts: GroundingContext[],
  topK: number
): GroundingContext[] => {
  const sortedContexts = [...contexts].sort(compareGroundingContexts);
  const selected: GroundingContext[] = [];
  const seenContentKeys = new Set<string>();
  const topScore = sortedContexts[0]?.score ?? 0;

  for (const context of sortedContexts) {
    if (selected.length >= topK) {
      break;
    }

    if (
      selected.length > 0 &&
      topScore > 0 &&
      context.score / topScore < MIN_RELATIVE_CONTEXT_SCORE_RATIO
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
      existingForAsset.some(
        (selectedContext) =>
          selectedContext.source.sourceType === "chunk" &&
          context.source.sourceType !== "chunk"
      )
    ) {
      continue;
    }

    if (
      existingForAsset.some(
        (selectedContext) =>
          selectedContext.source.sourceType === "assertion" &&
          context.source.sourceType === "summary"
      )
    ) {
      continue;
    }

    const contentKey = [
      context.asset.id,
      context.source.sourceType,
      normalizeComparableText(context.contentText).slice(0, 240),
    ].join(":");

    if (seenContentKeys.has(contentKey)) {
      continue;
    }

    seenContentKeys.add(contentKey);
    selected.push(context);
  }

  return selected;
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
        compareGroundingContexts
      );
      const selectedLexicalContexts = selectGroundingContexts(
        lexicalContexts,
        topK
      );

      if (selectedLexicalContexts.length === 0) {
        return withOptionalResultScope(
          {
            answer: createFallbackAnswer(),
            sources: [],
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
          },
          resultScope
        );
      }

      const answer = await aiProvider.generateText({
        systemPrompt:
          "You are a source-aware knowledge base assistant. " +
          "Keep answers concise and grounded in the provided sources. " +
          "Do not repeat the source list. Do not output labels such as " +
          "'Asset ID', 'Source Type', 'Source URL', or 'Snippet'.",
        prompt: buildChatPrompt(question, selectedLexicalContexts),
        temperature: 0.2,
        maxOutputTokens: 700,
      });
      const sanitizedAnswer = sanitizeAnswerText(answer.text);

      return withOptionalResultScope(
        {
          answer:
            sanitizedAnswer.length > 0
              ? sanitizedAnswer
              : createFallbackAnswer(),
          sources: selectedLexicalContexts.map((context) => context.source),
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
      .filter((context) =>
        matchesContextPolicyAsset(context.asset, contextPolicy)
      );
    const allGroundingContexts = [
      ...groundingContexts,
      ...assertionContexts,
      ...summaryContexts,
    ].sort(compareGroundingContexts);
    const selectedGroundingContexts = selectGroundingContexts(
      allGroundingContexts,
      topK
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
        },
        resultScope
      );
    }

    const answer = await aiProvider.generateText({
      systemPrompt:
        "You are a source-aware knowledge base assistant. " +
        "Keep answers concise and grounded in the provided sources. " +
        "Do not repeat the source list. Do not output labels such as " +
        "'Asset ID', 'Source Type', 'Source URL', or 'Snippet'.",
      prompt: buildChatPrompt(question, selectedGroundingContexts),
      temperature: 0.2,
      maxOutputTokens: 700,
    });
    const sanitizedAnswer = sanitizeAnswerText(answer.text);

    return withOptionalResultScope(
      {
        answer:
          sanitizedAnswer.length > 0 ? sanitizedAnswer : createFallbackAnswer(),
        sources: selectedGroundingContexts.map((context) => context.source),
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
