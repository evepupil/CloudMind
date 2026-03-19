import type { Hono } from "hono";

import type { AppEnv } from "@/env";

// 这里提供最小健康检查接口，便于 Pages 联调与后续监控。
export const registerHealthRoutes = (app: Hono<AppEnv>): void => {
  app.get("/api/health", (context) => {
    return context.json({
      ok: true,
      service: "cloudmind",
      timestamp: new Date().toISOString(),
    });
  });
};
