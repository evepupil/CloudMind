import type { Hono } from "hono";

import type { AppEnv } from "@/env";

import { listAssets } from "./service";

interface IngestTextPayload {
  title?: string;
  content?: string;
}

// 这里注册资产相关 API，为后续知识库入口预留统一路径。
export const registerAssetRoutes = (app: Hono<AppEnv>): void => {
  app.get("/api/assets", (context) => {
    return context.json({
      items: listAssets(),
    });
  });

  app.post("/api/ingest/text", async (context) => {
    const payload = await context.req.json<IngestTextPayload>();

    return context.json(
      {
        ok: true,
        message: "Ingest pipeline is not implemented yet.",
        received: {
          title: payload.title ?? "Untitled",
          contentLength: payload.content?.length ?? 0,
        },
      },
      202
    );
  });
};
