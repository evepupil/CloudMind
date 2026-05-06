import type { PromptTemplate } from "@/core/prompts/types";
import type { AssetSourceKind } from "@/features/assets/model/types";
import {
  assetDocumentClassValues,
  assetDomainValues,
} from "@/features/ingest/model/enrichment";

export const enrichmentDescriptorV1: PromptTemplate<{
  title?: string | undefined;
  content: string;
  summary?: string | undefined;
  sourceKind?: AssetSourceKind | undefined;
}> = {
  id: "enrichment-descriptor",
  version: 1,
  description: "Generate descriptor enrichment for workflow-based assets",
  build: (input) => ({
    prompt: [
      "请为 CloudMind 资产生成 descriptor enrichment，返回 JSON。",
      "要求：",
      `- domain 必须从: ${assetDomainValues.join(", ")}`,
      `- documentClass 必须从: ${assetDocumentClassValues.join(", ")}`,
      "- topics/tags 请尽量具体，便于后续复用",
      "- catalog 对应 collectionKey，推荐稳定、可复用命名",
      "- 不要输出 summary，不要输出解释文字，只输出 JSON",
      "JSON schema:",
      "{",
      '  "domain": "enum?",',
      '  "documentClass": "enum?",',
      '  "topics": ["string"],',
      '  "tags": ["string"],',
      '  "catalog": "string?",',
      '  "signals": ["string"]',
      "}",
      "输入标题:",
      input.title?.trim() || "(none)",
      "已有摘要:",
      input.summary?.trim() || "(none)",
      "输入正文:",
      input.content,
    ].join("\n"),
  }),
};
