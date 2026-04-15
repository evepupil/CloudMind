import { z } from "zod";
import type { AIProvider } from "@/core/ai/ports";
import type { CreateAssetAssertionInput } from "@/core/assets/ports";
import { buildAIInvocationFields } from "@/features/ingest/server/ai-observability";
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

const extractJsonPayload = (text: string): string | null => {
  const trimmed = text.trim();

  if (!trimmed) {
    return null;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
};

const parseJsonObject = (text: string): unknown => {
  const payload = extractJsonPayload(text);

  if (!payload) {
    throw new Error("AI response does not contain a JSON payload.");
  }

  return JSON.parse(payload);
};

const buildAssertionPrompt = (context: AssertionExtractionContext): string => {
  return [
    "请为 CloudMind 资产抽取 3 到 5 条高价值 assertions，返回 JSON。",
    "要求：",
    "- kind 只能是 fact、decision、constraint、summary_point 之一",
    "- text 要简洁、完整、可独立理解",
    "- 优先抽取能帮助检索和问答的关键结论、约束、决定",
    "- 没有足够高价值 assertion 时可以少于 5 条",
    "- 不要输出解释文字，只输出 JSON",
    "JSON schema:",
    "{",
    '  "assertions": [',
    '    {"kind":"fact|decision|constraint|summary_point","text":"string","confidence":0.0}',
    "  ]",
    "}",
    "资产标题:",
    context.asset.title?.trim() || "(none)",
    "已有摘要:",
    context.summary?.trim() || "(none)",
    "正文:",
    context.normalizedContent?.trim() || "(none)",
  ].join("\n");
};

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
      prompt: buildAssertionPrompt(context),
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

  let parsed: z.SafeParseReturnType<
    z.infer<typeof aiAssertionSchema>,
    z.infer<typeof aiAssertionSchema>
  >;

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
