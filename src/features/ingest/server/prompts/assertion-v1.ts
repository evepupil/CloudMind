import type { PromptTemplate } from "@/core/prompts/types";
import type { AssetDetail } from "@/features/assets/model/types";

export const assertionV1: PromptTemplate<{
  asset: AssetDetail;
  normalizedContent?: string | null | undefined;
  summary?: string | null | undefined;
}> = {
  id: "assertion",
  version: 1,
  description: "Extract 3-5 high-value assertions from a CloudMind asset",
  build: (input) => ({
    prompt: [
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
      input.asset.title?.trim() || "(none)",
      "已有摘要:",
      input.summary?.trim() || "(none)",
      "正文:",
      input.normalizedContent?.trim() || "(none)",
    ].join("\n"),
  }),
};
