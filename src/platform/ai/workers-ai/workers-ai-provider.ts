import type {
  AIProvider,
  CreateEmbeddingsInput,
  CreateEmbeddingsResult,
  GenerateTextInput,
  GenerateTextResult,
} from "@/core/ai/ports";

const EMBEDDING_MODEL = "@cf/baai/bge-m3";
const TEXT_GENERATION_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const PROVIDER_NAME = "workers_ai";

interface WorkersAITextGenerationChoice {
  message?:
    | {
        content?: string | undefined;
      }
    | undefined;
  text?: string | undefined;
}

interface WorkersAITextGenerationOutput {
  response?: string | undefined;
  choices?: WorkersAITextGenerationChoice[] | undefined;
}

interface WorkersAIEmbeddingsOutput {
  data?: number[][] | undefined;
  response?: number[][] | undefined;
  shape?: number[] | undefined;
}

export const extractGeneratedText = (output: unknown): string => {
  if (typeof output === "string") {
    return output;
  }

  if (!output || typeof output !== "object") {
    return "";
  }

  const parsedOutput = output as WorkersAITextGenerationOutput;

  if (typeof parsedOutput.response === "string") {
    return parsedOutput.response;
  }

  const firstChoice = parsedOutput.choices?.[0];

  if (typeof firstChoice?.message?.content === "string") {
    return firstChoice.message.content;
  }

  if (typeof firstChoice?.text === "string") {
    return firstChoice.text;
  }

  return "";
};

// 这里封装 Workers AI，避免业务层直接依赖 Cloudflare 运行时细节。
export class WorkersAIProvider implements AIProvider {
  private readonly ai: Ai;

  public constructor(ai: Ai) {
    this.ai = ai;
  }

  public async generateText(
    input: GenerateTextInput
  ): Promise<GenerateTextResult> {
    const prompt = input.systemPrompt
      ? `${input.systemPrompt}\n\n${input.prompt}`
      : input.prompt;
    const modelInput: {
      prompt: string;
      temperature?: number;
      max_tokens?: number;
    } = {
      prompt,
    };

    if (input.temperature !== undefined) {
      modelInput.temperature = input.temperature;
    }

    if (input.maxOutputTokens !== undefined) {
      modelInput.max_tokens = input.maxOutputTokens;
    }

    const output = await this.ai.run(TEXT_GENERATION_MODEL, modelInput);

    return {
      text: extractGeneratedText(output),
      provider: PROVIDER_NAME,
      model: TEXT_GENERATION_MODEL,
    };
  }

  public async createEmbeddings(
    input: CreateEmbeddingsInput
  ): Promise<CreateEmbeddingsResult> {
    if (input.texts.length === 0) {
      return {
        embeddings: [],
        provider: PROVIDER_NAME,
        model: EMBEDDING_MODEL,
      };
    }

    const texts = input.purpose === "query" ? input.texts : input.texts.slice();
    const output = (await this.ai.run(EMBEDDING_MODEL, {
      text: texts,
      truncate_inputs: true,
    })) as WorkersAIEmbeddingsOutput;
    const embeddings = output.data ?? output.response ?? [];

    return {
      embeddings,
      provider: PROVIDER_NAME,
      model: EMBEDDING_MODEL,
      dimensions: output.shape?.[1] ?? embeddings[0]?.length,
    };
  }
}
