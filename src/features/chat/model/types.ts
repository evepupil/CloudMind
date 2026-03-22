import type { ContextResultScope } from "@/features/search/model/types";

export interface ChatSource {
  sourceType: "chunk" | "summary" | "assertion";
  assetId: string;
  chunkId?: string | undefined;
  title: string;
  sourceUrl: string | null;
  snippet: string;
}

export interface AskLibraryIndexingSummary {
  matchedLayers: Array<ChatSource["sourceType"]>;
  domains: string[];
  documentClasses: string[];
  sourceKinds: string[];
  sourceHosts: string[];
  collections: string[];
  topics: string[];
}

export interface AskLibraryInput {
  question: string;
  topK?: number | undefined;
}

export interface AskLibraryResult {
  answer: string;
  sources: ChatSource[];
  indexingSummary?: AskLibraryIndexingSummary | undefined;
  resultScope?: ContextResultScope | undefined;
}
