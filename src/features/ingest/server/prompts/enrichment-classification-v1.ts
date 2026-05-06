import type { PromptTemplate } from "@/core/prompts/types";
import type { TextAssetEnrichmentInput } from "@/features/ingest/model/enrichment";
import {
  assetDocumentClassValues,
  assetDomainValues,
} from "@/features/ingest/model/enrichment";

export const enrichmentClassificationV1: PromptTemplate<{
  title?: string | undefined;
  content: string;
  enrichment: TextAssetEnrichmentInput;
}> = {
  id: "enrichment-classification",
  version: 1,
  description:
    "Fill in missing classification fields for a CloudMind text asset",
  build: (input) => ({
    prompt: [
      "请为 CloudMind 文本资产补齐 classification，返回 JSON。",
      "要求：",
      `- domain 必须从: ${assetDomainValues.join(", ")}`,
      `- documentClass 必须从: ${assetDocumentClassValues.join(", ")}`,
      "- 如果已有值合法，可保留；如果缺失，请根据标题、摘要、正文补齐",
      "- 不要输出解释文字，只输出 JSON",
      "JSON schema:",
      "{",
      '  "domain": "enum?",',
      '  "documentClass": "enum?"',
      "}",
      "已有 enrichment:",
      JSON.stringify({
        summary: input.enrichment.summary,
        domain: input.enrichment.domain,
        documentClass: input.enrichment.documentClass,
        descriptor: input.enrichment.descriptor,
      }),
      "输入标题:",
      input.title?.trim() || "(none)",
      "输入正文:",
      input.content,
    ].join("\n"),
  }),
};
