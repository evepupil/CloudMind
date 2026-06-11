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

// qwen3 等推理模型即便在 chat 模式下仍可能吐 <think>…</think> 推理块。
// 统一在 provider 出口剥离，避免推理文本混入摘要/标题等下游自由文本。
// 第二条 replace 兜底「被 max_tokens 截断、只有开标签没有 </think>」的情况——
// 否则惰性匹配找不到闭合标签，整段 reasoning 会原样泄漏进输出。
export const stripReasoningBlocks = (text: string): string =>
  text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .trim();

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
    // 用 chat messages 格式（system + user）而非 raw { prompt } completion——
    // qwen3 是指令模型，completion 模式下会续写 prompt（echo「要求/标题/正文」+
    // 重复），污染摘要/标题。chat 格式下模型把 prompt 当指令执行，从根上消除 echo。
    const messages: Array<{ role: "system" | "user"; content: string }> = [];

    if (input.systemPrompt) {
      messages.push({ role: "system", content: input.systemPrompt });
    }

    messages.push({ role: "user", content: input.prompt });

    const modelInput: {
      messages: Array<{ role: "system" | "user"; content: string }>;
      temperature?: number;
      max_tokens?: number;
    } = {
      messages,
    };

    if (input.temperature !== undefined) {
      modelInput.temperature = input.temperature;
    }

    if (input.maxOutputTokens !== undefined) {
      modelInput.max_tokens = input.maxOutputTokens;
    }

    const output = await this.ai.run(TEXT_GENERATION_MODEL, modelInput);

    return {
      text: stripReasoningBlocks(extractGeneratedText(output)),
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
