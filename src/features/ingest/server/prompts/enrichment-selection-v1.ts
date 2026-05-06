import { z } from "zod";
import type { PromptTemplate } from "@/core/prompts/types";

const HIGH_CONFIDENCE_THRESHOLD = 0.86;
const LOW_CONFIDENCE_THRESHOLD = 0.72;

const candidateSchema = z.object({
  summary: z.string().trim().min(1).max(2000).optional(),
  domain: z
    .enum([
      "engineering",
      "product",
      "research",
      "personal",
      "finance",
      "health",
      "archive",
      "general",
    ] as const)
    .optional(),
  documentClass: z
    .enum([
      "reference_doc",
      "design_doc",
      "bug_note",
      "paper",
      "journal_entry",
      "meeting_note",
      "spec",
      "howto",
      "general_note",
    ] as const)
    .optional(),
  topics: z.array(z.string().trim().min(1).max(80)).max(6).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(6).optional(),
  catalog: z.string().trim().min(1).max(120).optional(),
  signals: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
});

interface TermCandidateMatch {
  term: string;
  score: number;
}

interface TermCandidateWithMatches {
  candidate: string;
  matches: TermCandidateMatch[];
}

export const enrichmentSelectionV1: PromptTemplate<{
  title?: string | undefined;
  content: string;
  candidate: z.infer<typeof candidateSchema>;
  topicHints: TermCandidateWithMatches[];
  tagHints: TermCandidateWithMatches[];
  catalogHints: TermCandidateMatch[];
}> = {
  id: "enrichment-selection",
  version: 1,
  description:
    "Make final selection decisions for metadata based on candidate and term similarity",
  build: (input) => ({
    prompt: [
      "请根据候选 metadata 与已有词项近邻，给出最终选择 JSON。",
      "规则：",
      `- 分数 >= ${HIGH_CONFIDENCE_THRESHOLD.toFixed(2)} 优先复用已有词项`,
      `- 分数 < ${LOW_CONFIDENCE_THRESHOLD.toFixed(2)} 可新建`,
      "- 中间分数区间由你判断最合理方案",
      "- domain/documentClass 只能保留候选中的合法值",
      "- 不要输出解释，只输出 JSON",
      "JSON schema:",
      "{",
      '  "summary": "string?",',
      '  "domain": "enum?",',
      '  "documentClass": "enum?",',
      '  "topics": [{"mode":"reuse|new","value":"string"}],',
      '  "tags": [{"mode":"reuse|new","value":"string"}],',
      '  "catalog": {"mode":"reuse|new","value":"string"},',
      '  "signals": ["string"]',
      "}",
      "候选 metadata:",
      JSON.stringify(input.candidate),
      "topics 近邻：",
      JSON.stringify(input.topicHints),
      "tags 近邻：",
      JSON.stringify(input.tagHints),
      "catalog 近邻：",
      JSON.stringify(input.catalogHints),
      "输入标题:",
      input.title?.trim() || "(none)",
      "输入正文:",
      input.content,
    ].join("\n"),
  }),
};
