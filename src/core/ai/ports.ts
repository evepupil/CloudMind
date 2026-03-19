export interface GenerateTextInput {
  prompt: string;
  systemPrompt?: string | undefined;
  temperature?: number | undefined;
  maxOutputTokens?: number | undefined;
}

export interface GenerateTextResult {
  text: string;
  model?: string | undefined;
}

export type EmbeddingPurpose = "document" | "query";

export interface CreateEmbeddingsInput {
  texts: string[];
  purpose?: EmbeddingPurpose | undefined;
}

export interface CreateEmbeddingsResult {
  embeddings: number[][];
  model?: string | undefined;
  dimensions?: number | undefined;
}

// 这里统一 AI Provider 抽象，后续可以在 Workers AI / OpenAI 之间切换。
export interface AIProvider {
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  createEmbeddings(
    input: CreateEmbeddingsInput
  ): Promise<CreateEmbeddingsResult>;
}
