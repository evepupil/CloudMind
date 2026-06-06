import type {
  AIProvider,
  CreateEmbeddingsInput,
  CreateEmbeddingsResult,
  GenerateTextInput,
  GenerateTextResult,
  RerankInput,
  RerankResult,
} from "@/core/ai/ports";

const EMBEDDING_MODEL = "@cf/baai/bge-m3";
const TEXT_GENERATION_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const RERANKER_MODEL = "@cf/baai/bge-reranker-base";
const PROVIDER_NAME = "workers_ai";

interface WorkersAIRerankOutput {
  response?: Array<{ id?: number; score?: number }> | undefined;
}

// bge-m3 支持非对称检索：给 query 加指令前缀、passage 不加。
// 这样既启用了之前形同虚设的 purpose 标志，又保持 passage 向量不变（无需重嵌语料）。
const QUERY_EMBEDDING_INSTRUCTION =
  "Represent this query for retrieving relevant documents: ";

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

  public readonly embeddingModel = EMBEDDING_MODEL;

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

    const texts =
      input.purpose === "query"
        ? input.texts.map((text) => `${QUERY_EMBEDDING_INSTRUCTION}${text}`)
        : input.texts.slice();
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

  public async rerank(input: RerankInput): Promise<RerankResult[]> {
    if (input.documents.length === 0) {
      return [];
    }

    // bge-reranker-base：输入 query + contexts，输出 [{ id(=contexts 下标), score }]。
    const output = (await this.ai.run(RERANKER_MODEL, {
      query: input.query,
      contexts: input.documents.map((text) => ({ text })),
      top_k: input.topN ?? input.documents.length,
    })) as WorkersAIRerankOutput;

    return (output.response ?? [])
      .filter(
        (item): item is { id: number; score: number } =>
          typeof item.id === "number" && typeof item.score === "number"
      )
      .map((item) => ({ index: item.id, score: item.score }));
  }
}
