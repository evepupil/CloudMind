export interface ChatSource {
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
}
