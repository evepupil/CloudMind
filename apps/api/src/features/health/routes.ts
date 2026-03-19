import type { Hono } from "hono";

import type { AppEnv } from "../../env";

// 这里挂载基础健康检查路由，便于后续部署联调。
export const registerHealthRoutes = (app: Hono<AppEnv>): void => {
  app.get("/health", (context) => {
    return context.json({
      ok: true,
      service: "cloudmind-api",
      timestamp: new Date().toISOString(),
    });
  });
};
