import { z } from "zod";

import type { AIProvider } from "@/core/ai/ports";
import { createLogger } from "@/core/logging/logger";

const logger = createLogger("memory_graph_extraction");

// 归一化实体名：小写 + 折叠空白 + 去首尾空白。用于 (scope, normalized_name) 幂等消歧。
// 注：这是 v1 的"精确名"消歧；基于 embedding 的近似消歧（0.86/0.72 阈值）留待下一增量。
export const normalizeEntityName = (name: string): string =>
  name.toLowerCase().replace(/\s+/g, " ").trim();

export interface ExtractedEntity {
  name: string;
  type: string | null;
}

export interface ExtractedStatement {
  subject: string;
  predicate: string;
  object: string;
  // 宾语是否为实体：true → 构成图边；false → 字面值属性。
  objectIsEntity: boolean;
  nlText: string;
  confidence: number | null;
}

export interface ExtractedGraph {
  entities: ExtractedEntity[];
  statements: ExtractedStatement[];
}

const EMPTY_GRAPH: ExtractedGraph = { entities: [], statements: [] };

const graphSchema = z.object({
  entities: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        type: z.string().trim().max(40).optional(),
      })
    )
    .max(30)
    .optional(),
  statements: z
    .array(
      z.object({
        subject: z.string().trim().min(1).max(120),
        predicate: z.string().trim().min(1).max(60),
        object: z.string().trim().min(1).max(200),
        object_is_entity: z.boolean().optional(),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .max(40)
    .optional(),
});

// 把 AI 返回的原始 JSON 校验并投影为内部抽取结构；不合法返回 null。
export const parseExtractedGraph = (raw: unknown): ExtractedGraph | null => {
  const parsed = graphSchema.safeParse(raw);

  if (!parsed.success) {
    return null;
  }

  return {
    entities: (parsed.data.entities ?? []).map((entity) => ({
      name: entity.name,
      type: entity.type ?? null,
    })),
    statements: (parsed.data.statements ?? []).map((statement) => ({
      subject: statement.subject,
      predicate: statement.predicate,
      object: statement.object,
      objectIsEntity: statement.object_is_entity ?? false,
      nlText: `${statement.subject} ${statement.predicate} ${statement.object}`,
      confidence: statement.confidence ?? null,
    })),
  };
};

// qwen3 等推理模型会先输出 <think>…</think>，其中常含花括号，会让 parseJsonObject 的
// 「首{到末}」切片把推理文本一起吞进去导致 JSON.parse 失败。这里先剥离 think 块再解析。
export const stripReasoning = (text: string): string =>
  text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

// 从可能含散文前缀 / markdown fence / 重复多个对象的响应里，提取**第一个花括号平衡**的完整 JSON 对象。
// 这是关键修复：qwen 常在 JSON 前续写文本、并把同一对象重复多遍，朴素的「首{到末}」切片会跨多个对象导致解析失败。
export const extractFirstJsonObject = (text: string): string | null => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const haystack = fenced?.[1] ?? text;
  const start = haystack.indexOf("{");

  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < haystack.length; i += 1) {
    const ch = haystack[i];

    if (escaped) {
      escaped = false;
    } else if (ch === "\\") {
      escaped = true;
    } else if (ch === '"') {
      inString = !inString;
    } else if (!inString && ch === "{") {
      depth += 1;
    } else if (!inString && ch === "}") {
      depth -= 1;

      if (depth === 0) {
        return haystack.slice(start, i + 1);
      }
    }
  }

  return null;
};

// 把模型原始响应解析为抽取图：剥 think → 取第一个平衡 JSON 对象 → Zod 校验。失败返回 null。
export const parseGraphResponse = (text: string): ExtractedGraph | null => {
  const jsonText = extractFirstJsonObject(stripReasoning(text));

  if (!jsonText) {
    return null;
  }

  let raw: unknown;

  try {
    raw = JSON.parse(jsonText);
  } catch {
    return null;
  }

  return parseExtractedGraph(raw);
};

const SYSTEM_PROMPT = [
  "You extract a knowledge graph from text for a personal memory layer.",
  "Return ONLY a JSON object, no prose, with this exact shape:",
  '{"entities":[{"name":"...","type":"..."}],',
  '"statements":[{"subject":"...","predicate":"...","object":"...","object_is_entity":true,"confidence":0.9}]}',
  "Rules:",
  "- entities: the salient people/orgs/concepts/places/products mentioned; type is a short lowercase noun (person, org, concept, place, product, event).",
  "- statements: factual subject-predicate-object triples grounded in the text only; do not invent.",
  "- object_is_entity=true when the object is itself a named entity (a graph relation); false when it is a literal value.",
  "- predicate is a short lowercase verb phrase.",
  "- Keep it tight: omit trivia. Use the text's own language (Chinese stays Chinese).",
].join("\n");

// 从文本抽取知识图谱（entities + SPO statements）。失败/不合法一律优雅退回空图，不抛错阻塞主链路。
export const extractGraphFromText = async (
  aiProvider: AIProvider,
  text: string,
  options?: { maxChars?: number | undefined }
): Promise<ExtractedGraph> => {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return EMPTY_GRAPH;
  }

  const body = trimmed.slice(0, options?.maxChars ?? 6000);

  let result: { text: string };

  try {
    result = await aiProvider.generateText({
      systemPrompt: SYSTEM_PROMPT,
      // 定界 <text> 防止模型续写正文；/no_think 关闭 qwen3 推理链路直接产出 JSON。
      prompt: `Extract entities and subject-predicate-object statements ONLY from the text between the <text> tags. Do not continue, complete, or invent any content. Respond with a single JSON object and nothing else. /no_think\n\n<text>\n${body}\n</text>`,
      temperature: 0.1,
      maxOutputTokens: 1200,
    });
  } catch (error) {
    logger.warn("graph_extraction_failed", {}, { error });

    return EMPTY_GRAPH;
  }

  const parsed = parseGraphResponse(result.text);

  if (!parsed) {
    logger.warn("graph_extraction_invalid", {});

    return EMPTY_GRAPH;
  }

  logger.info("graph_extraction_succeeded", {
    entityCount: parsed.entities.length,
    statementCount: parsed.statements.length,
  });

  return parsed;
};
