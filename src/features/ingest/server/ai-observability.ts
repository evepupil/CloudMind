import type {
  AIProvider,
  CreateEmbeddingsResult,
  GenerateTextResult,
} from "@/core/ai/ports";

const normalizeProviderName = (value: string): string => {
  return value
    .replace(/Provider$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
};

export const inferAIProviderName = (aiProvider: AIProvider): string => {
  const constructorName = aiProvider?.constructor?.name?.trim();

  if (!constructorName || constructorName === "Object") {
    return "unknown";
  }

  return normalizeProviderName(constructorName);
};

export const buildAIInvocationFields = (
  aiProvider: AIProvider,
  result?:
    | Pick<GenerateTextResult, "provider" | "model">
    | Pick<CreateEmbeddingsResult, "provider" | "model">
): {
  aiProvider: string;
  aiModel: string | null;
} => {
  return {
    aiProvider: result?.provider ?? inferAIProviderName(aiProvider),
    aiModel: result?.model ?? null,
  };
};
