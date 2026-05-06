import type { PromptTemplate } from "@/core/prompts/types";

const MAX_SUMMARY_SOURCE_CHARS = 12000;

export const summaryV1: PromptTemplate<{
  title?: string | null | undefined;
  content: string;
}> = {
  id: "summary",
  version: 1,
  description: "Generate a concise 1-3 sentence summary for a CloudMind asset",
  build: (input) => {
    const normalizedContent = input.content.replace(/\s+/g, " ").trim();
    const clippedContent = normalizedContent.slice(0, MAX_SUMMARY_SOURCE_CHARS);

    return {
      prompt: [
        "请为 CloudMind 资产生成一个高质量摘要。",
        "要求：",
        "- 只输出摘要正文，不要解释，不要列表，不要 Markdown。",
        "- 尽量保留原文语言。",
        "- 摘要应简洁、准确，适合资产列表和检索结果展示。",
        "- 控制在 1 到 3 句。",
        "标题：",
        input.title?.trim() || "(none)",
        "正文：",
        clippedContent,
      ].join("\n"),
    };
  },
};
