export interface PromptTemplate<TInput = object> {
  id: string;
  version: number;
  description: string;
  build: (input: TInput) => {
    systemPrompt?: string | undefined;
    prompt: string;
  };
}
