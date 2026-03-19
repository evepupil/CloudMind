import type { Hono } from "hono";

import type { AppEnv } from "../../env";
import { listAssets } from "./service";

// 这里挂载资产相关路由，作为后续知识库能力的主入口。
export const registerAssetRoutes = (app: Hono<AppEnv>): void => {
  app.get("/api/assets", (context) => {
    return context.json({
      items: listAssets(),
    });
  });

  app.post("/api/ingest/text", async (context) => {
    const payload = await context.req.json<{
      title?: string;
      content?: string;
    }>();

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
