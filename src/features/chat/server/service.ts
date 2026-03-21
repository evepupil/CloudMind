import type { AIProvider } from "@/core/ai/ports";
import type { AssetSearchRepository } from "@/core/assets/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { AppBindings } from "@/env";
import type { AssetSummary } from "@/features/assets/model/types";
import type { ContextRetrievalPolicy } from "@/features/mcp/server/context-profiles";
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

interface GroundingContext {
  score: number;
  source: ChatSource;
  contentText: string;
  asset: AssetSummary;
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

  if (contexts.length >= MIN_CONTEXT_COUNT && coverage >= MIN_CONTEXT_COVERAGE) {
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

  return buildSummaryGroundingContexts(question, summaryMatches).map(
    (context) => ({
      ...context,
      score: applyContextPolicyScore(context.score, context.asset, contextPolicy),
    })
  ).filter((context) => matchesContextPolicyAsset(context.asset, contextPolicy));
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

    if (!queryVector) {
      if (summaryContexts.length === 0) {
        return withOptionalResultScope({
          answer: createFallbackAnswer(),
          sources: [],
        }, getContextResultScope([], contextPolicy));
      }

      const orderedSummaryContexts = [...summaryContexts]
        .sort((left, right) => right.score - left.score)
        .slice(0, topK);
      const resultScope = getContextResultScope(
        orderedSummaryContexts.map((context) => context.asset),
        contextPolicy
      );

      if (
        shouldRejectContextAnswer(question, orderedSummaryContexts, contextPolicy)
      ) {
        return withOptionalResultScope({
          answer: createFallbackAnswer(),
          sources: [],
        }, resultScope);
      }

      const answer = await aiProvider.generateText({
        systemPrompt:
          "You are a source-aware knowledge base assistant. Keep answers concise and grounded in the provided sources.",
        prompt: buildChatPrompt(question, orderedSummaryContexts),
        temperature: 0.2,
        maxOutputTokens: 700,
      });

      return withOptionalResultScope({
        answer:
          answer.text.trim().length > 0
            ? answer.text.trim()
            : createFallbackAnswer(),
        sources: orderedSummaryContexts.map((context) => context.source),
      }, resultScope);
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
    ).map((context) => ({
      ...context,
      score: applyContextPolicyScore(context.score, context.asset, contextPolicy),
    })).filter((context) =>
      matchesContextPolicyAsset(context.asset, contextPolicy)
    );
    const allGroundingContexts = [...groundingContexts, ...summaryContexts]
      .sort((left, right) => right.score - left.score)
      .slice(0, topK);
    const resultScope = getContextResultScope(
      allGroundingContexts.map((context) => context.asset),
      contextPolicy
    );

    if (allGroundingContexts.length === 0) {
      return withOptionalResultScope({
        answer: createFallbackAnswer(),
        sources: [],
      }, resultScope);
    }

    if (
      shouldRejectContextAnswer(question, allGroundingContexts, contextPolicy)
    ) {
      return withOptionalResultScope({
        answer: createFallbackAnswer(),
        sources: [],
      }, resultScope);
    }

    const answer = await aiProvider.generateText({
      systemPrompt:
        "You are a source-aware knowledge base assistant. Keep answers concise and grounded in the provided sources.",
      prompt: buildChatPrompt(question, allGroundingContexts),
      temperature: 0.2,
      maxOutputTokens: 700,
    });

    return withOptionalResultScope({
      answer:
        answer.text.trim().length > 0
          ? answer.text.trim()
          : createFallbackAnswer(),
      sources: allGroundingContexts.map((context) => context.source),
    }, resultScope);
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
