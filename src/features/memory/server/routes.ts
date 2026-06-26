import type { Hono } from "hono";

import type { AppEnv } from "@/env";
import {
  getConsolidationView,
  getGraphView,
  getTimelineView,
} from "./memory-browse-service";

// 记忆层只读 API：供前端记忆层区（图谱/时间线/整合）渲染。只读、默认 personal scope。
export const registerMemoryRoutes = (app: Hono<AppEnv>): void => {
  app.get("/api/memory/graph", async (context) => {
    const view = await getGraphView(context.env);
    return context.json(view);
  });

  app.get("/api/memory/timeline", async (context) => {
    const view = await getTimelineView(context.env);
    return context.json(view);
  });

  app.get("/api/memory/consolidation", async (context) => {
    const view = await getConsolidationView(context.env);
    return context.json(view);
  });
};
