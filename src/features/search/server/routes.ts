import type { Hono } from "hono";
import type { z } from "zod";

import type { AppEnv } from "@/env";

import { assetSearchPayloadSchema } from "./schemas";
import { searchAssets } from "./service";

const getValidationErrorBody = (error: z.ZodError) => {
  return {
    error: {
      code: "INVALID_INPUT",
      message: "Invalid request payload",
      details: error.flatten(),
    },
  };
};

// 这里注册搜索相关 API，便于后续继续独立出语义检索与问答检索。
export const registerSearchRoutes = (app: Hono<AppEnv>): void => {
  app.post("/api/search", async (context) => {
    const rawPayload = await context.req.json().catch(() => null);
    const parsedPayload = assetSearchPayloadSchema.safeParse(rawPayload);

    if (!parsedPayload.success) {
      return context.json(getValidationErrorBody(parsedPayload.error), 400);
    }

    const result = await searchAssets(context.env, parsedPayload.data);

    return context.json(result);
  });
};
