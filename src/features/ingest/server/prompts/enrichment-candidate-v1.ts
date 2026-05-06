import type { PromptTemplate } from "@/core/prompts/types";
import {
  assetDocumentClassValues,
  assetDomainValues,
} from "@/features/ingest/model/enrichment";

export const enrichmentCandidateV1: PromptTemplate<{
  title?: string | undefined;
  content: string;
}> = {
  id: "enrichment-candidate",
  version: 1,
  description: "Generate metadata candidates for a CloudMind text asset",
  build: (input) => ({
    prompt: [
      "请为 CloudMind 文本资产生成 metadata 候选，返回 JSON。",
      "要求：",
      `- domain 必须从: ${assetDomainValues.join(", ")}`,
      `- documentClass 必须从: ${assetDocumentClassValues.join(", ")}`,
      "- topics/tags 请给多个候选，避免过于宽泛",
      "- catalog 对应 collectionKey，推荐稳定可复用命名",
      "- 不要输出解释文字，只输出 JSON",
      "JSON schema:",
      "{",
      '  "summary": "string?",',
      '  "domain": "enum?",',
      '  "documentClass": "enum?",',
      '  "topics": ["string"],',
      '  "tags": ["string"],',
      '  "catalog": "string?",',
      '  "signals": ["string"]',
      "}",
      "输入标题:",
      input.title?.trim() || "(none)",
      "输入正文:",
      input.content,
    ].join("\n"),
  }),
};
