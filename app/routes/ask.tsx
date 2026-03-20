import { createRoute } from "honox/factory";
import { AskPage } from "@/features/chat/components/ask-page";
import type { AskLibraryResult } from "@/features/chat/model/types";

const parseChatError = async (response: Response): Promise<string> => {
  const payload = (await response.json().catch(() => null)) as {
    error?: {
      message?: string | undefined;
    };
  } | null;

  return payload?.error?.message ?? "Ask request failed.";
};

// 这里让 Ask 页通过真实 /api/chat 入口渲染结果，先保持最小闭环。
export default createRoute(async (context) => {
  const question = context.req.query("question")?.trim() ?? "";
  let result: AskLibraryResult | null = null;
  let errorMessage: string | null = null;

  if (question.length > 0) {
    const response = await fetch(new URL("/api/chat", context.req.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        topK: 5,
      }),
    });

    if (response.ok) {
      result = (await response.json()) as AskLibraryResult;
    } else {
      errorMessage = await parseChatError(response);
    }
  }

  return context.render(
    <AskPage question={question} result={result} errorMessage={errorMessage} />
  );
});
