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

// 这里保留统一 AI Provider 抽象，后续可在 Workers AI / OpenAI 等实现间切换。
export interface AIProvider {
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
}
