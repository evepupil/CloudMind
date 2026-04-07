import { createRoute } from "honox/factory";
import { AskPage } from "@/features/chat/components/ask-page";
import type { AskLibraryResult } from "@/features/chat/model/types";
import { askLibrary } from "@/features/chat/server/service";

// 这里让 Ask 页通过真实 /api/chat 入口渲染结果，先保持最小闭环。
export default createRoute(async (context) => {
  const question = context.req.query("question")?.trim() ?? "";
  let result: AskLibraryResult | null = null;
  let errorMessage: string | null = null;

  if (question.length > 0) {
    try {
      result = await askLibrary(context.env, {
        question,
        topK: 5,
      });
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Ask request failed.";
    }
  }

  return context.render(
    <AskPage question={question} result={result} errorMessage={errorMessage} />
  );
});
