import type { ContextResultScope } from "@/features/search/model/types";

export interface ChatSource {
  sourceType: "chunk" | "summary";
  assetId: string;
  chunkId?: string | undefined;
  title: string;
  sourceUrl: string | null;
  snippet: string;
}

export interface AskLibraryInput {
  question: string;
  topK?: number | undefined;
}

export interface AskLibraryResult {
  answer: string;
  sources: ChatSource[];
  resultScope?: ContextResultScope | undefined;
}
