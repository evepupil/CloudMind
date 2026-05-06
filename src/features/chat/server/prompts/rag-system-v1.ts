import type { PromptTemplate } from "@/core/prompts/types";

const BASE =
  "You are a source-aware knowledge base assistant. " +
  "Keep answers concise and grounded in the provided sources. " +
  "Do not repeat the source list. Do not output labels such as " +
  "'Asset ID', 'Source Type', 'Source URL', or 'Snippet'.";

const RETRY_EXTRA =
  " Return a complete standalone answer. " +
  "Do not say 'same as above', 'same as v2', or refer to an unseen " +
  "previous answer. Preserve bullet formatting when using lists.";

export const ragSystemV1: PromptTemplate<{ variant: "base" | "retry" }> = {
  id: "rag-system",
  version: 1,
  description: "System prompt for the RAG knowledge base assistant",
  build: ({ variant }) => ({
    systemPrompt: variant === "retry" ? `${BASE}${RETRY_EXTRA}` : BASE,
    prompt: "",
  }),
};
