import { Hono } from "hono";

import type { AppEnv } from "./env";
import { registerAssetRoutes } from "./features/assets/routes";
import { registerHealthRoutes } from "./features/health/routes";

// 这里创建 API 应用，并集中注册所有 feature 路由。
export const createApp = (): Hono<AppEnv> => {
  const app = new Hono<AppEnv>();

  app.get("/", (context) => {
    return context.json({
      name: "cloudmind-api",
      message: "CloudMind API is ready.",
    });
  });

  registerHealthRoutes(app);
  registerAssetRoutes(app);

  return app;
};
