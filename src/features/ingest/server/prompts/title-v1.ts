import type { PromptTemplate } from "@/core/prompts/types";

const MAX_TITLE_SOURCE_CHARS = 6000;
const MAX_GENERATED_TITLE_CHARS = 120;

export const titleV1: PromptTemplate<{
  currentTitle?: string | null | undefined;
  summary: string;
  content: string;
}> = {
  id: "title",
  version: 1,
  description: "Generate a concise accurate title for a CloudMind asset",
  build: (input) => {
    const clippedContent = input.content
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TITLE_SOURCE_CHARS);

    return {
      prompt: [
        "请为 CloudMind 资产生成一个简洁准确的标题。",
        "要求：",
        "- 只输出标题正文，不要解释，不要 Markdown，不要引号。",
        "- 尽量保留原文语言。",
        "- 标题要像文档名、网页名或笔记名，不要写成摘要句子。",
        "- 尽量保留关键主题、实体、产品名。",
        `- 控制在 ${MAX_GENERATED_TITLE_CHARS} 个字符以内。`,
        "当前标题：",
        input.currentTitle?.trim() || "(none)",
        "已有摘要：",
        input.summary,
        "正文：",
        clippedContent,
      ].join("\n"),
    };
  },
};
