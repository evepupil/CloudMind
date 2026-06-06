export interface GenerateTextInput {
  prompt: string;
  systemPrompt?: string | undefined;
  temperature?: number | undefined;
  maxOutputTokens?: number | undefined;
}

export interface GenerateTextResult {
  text: string;
  provider?: string | undefined;
  model?: string | undefined;
}

export type EmbeddingPurpose = "document" | "query";

export interface CreateEmbeddingsInput {
  texts: string[];
  purpose?: EmbeddingPurpose | undefined;
}

export interface CreateEmbeddingsResult {
  embeddings: number[][];
  provider?: string | undefined;
  model?: string | undefined;
  dimensions?: number | undefined;
}

export interface RerankInput {
  query: string;
  documents: string[];
  topN?: number | undefined;
}

export interface RerankResult {
  // index 指回 documents 中的位置。
  index: number;
  score: number;
}

// 这里统一 AI Provider 抽象，后续可以在 Workers AI / OpenAI 之间切换。
export interface AIProvider {
  // 当前嵌入模型标识，供增量重嵌判断 chunk 是否因换模型而失效（可选，便于测试 fake 省略）。
  readonly embeddingModel?: string | undefined;
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  createEmbeddings(
    input: CreateEmbeddingsInput
  ): Promise<CreateEmbeddingsResult>;
  // cross-encoder 重排（可选，便于 provider 切换与测试 fake 省略）。
  rerank?(input: RerankInput): Promise<RerankResult[]>;
}
