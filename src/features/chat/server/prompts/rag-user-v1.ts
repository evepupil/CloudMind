import type { PromptTemplate } from "@/core/prompts/types";
import type { ChatSource } from "@/features/chat/model/types";

interface RagUserInput {
  question: string;
  sources: ChatSource[];
}

export const ragUserV1: PromptTemplate<RagUserInput> = {
  id: "rag-user",
  version: 1,
  description: "Build the RAG user prompt with question and library sources",
  build: ({ question, sources }) => {
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

    return {
      prompt: [
        "Answer the user's question using only the provided library sources.",
        "If the sources are insufficient, say so plainly.",
        "When making a claim, cite the relevant source labels like [S1].",
        "",
        `Question: ${question}`,
        "",
        "Sources:",
        sourceBlocks,
      ].join("\n"),
    };
  },
};
