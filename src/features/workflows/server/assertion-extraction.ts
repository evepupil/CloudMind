import { z } from "zod";
import type { AIProvider } from "@/core/ai/ports";
import type { CreateAssetAssertionInput } from "@/core/assets/ports";
import { buildAIInvocationFields } from "@/features/ingest/server/ai-observability";
import {
  ingestPromptRegistry,
  parseJsonObject,
} from "@/features/ingest/server/prompts";
import { createLogger } from "@/platform/observability/logger";
import { deriveAssertions } from "./indexing-policy";

interface AssertionExtractionContext {
  asset: Parameters<typeof deriveAssertions>[0]["asset"];
  normalizedContent?: string | null | undefined;
  summary?: string | null | undefined;
}

const assertionLogger = createLogger("ingest_assertions");

const aiAssertionSchema = z.object({
  assertions: z
    .array(
      z.object({
        kind: z.enum(["fact", "decision", "constraint", "summary_point"]),
        text: z.string().trim().min(1).max(320),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .max(5),
});

const toAssertions = (
  parsed: z.infer<typeof aiAssertionSchema>
): CreateAssetAssertionInput[] => {
  const deduped = new Set<string>();

  return parsed.assertions
    .filter((item) => {
      const key = item.text.toLowerCase();

      if (deduped.has(key)) {
        return false;
      }

      deduped.add(key);

      return true;
    })
    .slice(0, 5)
    .map((item, index) => ({
      assertionIndex: index,
      kind: item.kind,
      text: item.text,
      sourceChunkIndex: null,
      sourceSpanJson: null,
      confidence: item.confidence ?? 0.88,
    }));
};

export const deriveAssertionsWithAIFallback = async (
  aiProvider: AIProvider,
  context: AssertionExtractionContext
): Promise<CreateAssetAssertionInput[]> => {
  let result:
    | {
        text: string;
        provider?: string | undefined;
        model?: string | undefined;
      }
    | undefined;

  try {
    result = await aiProvider.generateText({
      ...ingestPromptRegistry.get("assertion").build(context),
      temperature: 0.1,
      maxOutputTokens: 900,
    });
  } catch (error) {
    assertionLogger.warn(
      "assertion_generation_failed",
      {
        ...buildAIInvocationFields(aiProvider),
        fallbackStrategy: "heuristic_assertions",
      },
      { error }
    );

    return deriveAssertions(context);
  }

  let parsed: ReturnType<typeof aiAssertionSchema.safeParse>;

  try {
    parsed = aiAssertionSchema.safeParse(parseJsonObject(result.text));
  } catch (error) {
    assertionLogger.warn(
      "assertion_generation_invalid",
      {
        ...buildAIInvocationFields(aiProvider, result),
        fallbackStrategy: "heuristic_assertions",
      },
      { error }
    );

    return deriveAssertions(context);
  }

  if (!parsed.success || parsed.data.assertions.length === 0) {
    assertionLogger.warn("assertion_generation_invalid", {
      ...buildAIInvocationFields(aiProvider, result),
      fallbackStrategy: "heuristic_assertions",
    });

    return deriveAssertions(context);
  }

  assertionLogger.info("assertion_generation_succeeded", {
    ...buildAIInvocationFields(aiProvider, result),
    assertionCount: parsed.data.assertions.length,
  });

  return toAssertions(parsed.data);
};
