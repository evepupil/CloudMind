import type { Hono } from "hono";
import type { z } from "zod";

import type { AppEnv } from "@/env";

import { askLibraryPayloadSchema } from "./schemas";
import { askLibrary } from "./service";

const getValidationErrorBody = (error: z.ZodError) => {
  return {
    error: {
      code: "INVALID_INPUT",
      message: "Invalid request payload",
      details: error.flatten(),
    },
  };
};

// 这里注册最小问答 API，先复用语义检索结果生成带来源回答。
export const registerChatRoutes = (app: Hono<AppEnv>): void => {
  app.post("/api/chat", async (context) => {
    const rawPayload = await context.req.json().catch(() => null);
    const parsedPayload = askLibraryPayloadSchema.safeParse(rawPayload);

    if (!parsedPayload.success) {
      return context.json(getValidationErrorBody(parsedPayload.error), 400);
    }

    const result = await askLibrary(context.env, parsedPayload.data);

    return context.json(result);
  });
};
