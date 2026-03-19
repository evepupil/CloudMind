import type { AIProvider } from "@/core/ai/ports";
import type { AssetSearchRepository } from "@/core/assets/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { AppBindings } from "@/env";
import { getAIProviderFromBindings } from "@/platform/ai/workers-ai/get-ai-provider";
import { getAssetSearchRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";
import { getVectorStoreFromBindings } from "@/platform/vector/vectorize/get-vector-store";

import type { AskLibraryInput, AskLibraryResult, ChatSource } from "../model/types";

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

const buildPrompt = (question: string, sources: ChatSource[]): string => {
  const sourceBlocks = sources
    .map((source, index) => {
      return [
        `[S${index + 1}] ${source.title}`,
        `Asset ID: ${source.assetId}`,
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

// 这里实现最小问答链路：query embedding -> Vectorize 召回 -> D1 回填 -> AI 生成答案。
export const createChatService = (
  dependencies: ChatServiceDependencies = defaultDependencies
) => {
  return {
    async askLibrary(
      bindings: AppBindings | undefined,
      input: AskLibraryInput
    ): Promise<AskLibraryResult> {
      const question = input.question.trim();

      if (!question) {
        throw new Error("Question is required.");
      }

      const topK = input.topK ?? 5;
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

      if (!queryVector) {
        return {
          answer: createFallbackAnswer(),
          sources: [],
        };
      }

      const vectorMatches = await vectorStore.search({
        values: queryVector,
        topK,
      });

      if (vectorMatches.length === 0) {
        return {
          answer: createFallbackAnswer(),
          sources: [],
        };
      }

      const chunkMatches = await repository.getChunkMatchesByVectorIds(
        vectorMatches.map((match) => match.id)
      );
      const chunkMatchMap = new Map(
        chunkMatches
          .filter((match) => match.vectorId)
          .map((match) => [match.vectorId as string, match])
      );
      const orderedSources = vectorMatches
        .map((match) => {
          const chunkMatch = chunkMatchMap.get(match.id);

          if (!chunkMatch) {
            return null;
          }

          const source: ChatSource = {
            assetId: chunkMatch.asset.id,
            chunkId: chunkMatch.id,
            title: chunkMatch.asset.title,
            sourceUrl: chunkMatch.asset.sourceUrl,
            snippet: chunkMatch.textPreview,
          };

          return source;
        })
        .filter((source) => source !== null);

      if (orderedSources.length === 0) {
        return {
          answer: createFallbackAnswer(),
          sources: [],
        };
      }

      const answer = await aiProvider.generateText({
        systemPrompt:
          "You are a source-aware knowledge base assistant. Keep answers concise and grounded in the provided sources.",
        prompt: buildPrompt(question, orderedSources),
        temperature: 0.2,
        maxOutputTokens: 700,
      });

      return {
        answer:
          answer.text.trim().length > 0 ? answer.text.trim() : createFallbackAnswer(),
        sources: orderedSources,
      };
    },
  };
};

const chatService = createChatService();

export const { askLibrary } = chatService;
