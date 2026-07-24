import type { Hono } from "hono";

import { AssetNotFoundError } from "@/core/assets/errors";
import { MemoryLifecycleError } from "@/core/memory/errors";
import type { AppEnv } from "@/env";
import {
  forgetMemory,
  restoreMemory,
  updateMemory,
} from "@/features/memory/server/lifecycle-service";
import {
  memoryManagementQuerySchema,
  memoryManagementTargetSchema,
  memoryManagementUpdateSchema,
} from "@/features/memory/server/management-schemas";
import {
  getManagedMemory,
  listManagedRecords,
} from "@/features/memory/server/management-service";
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

  app.get("/api/memory/manage", async (context) => {
    const parsed = memoryManagementQuerySchema.safeParse(context.req.queries());

    if (!parsed.success) {
      return context.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "Invalid memory management filters.",
            details: parsed.error.flatten(),
          },
        },
        400
      );
    }

    return context.json(await listManagedRecords(context.env, parsed.data));
  });

  app.get("/api/memory/manage/:id", async (context) => {
    const id = context.req.param("id");

    if (!id) {
      return context.json(
        { error: { code: "INVALID_INPUT", message: "Memory id is required." } },
        400
      );
    }

    try {
      return context.json(await getManagedMemory(context.env, id));
    } catch (error) {
      const notFound =
        error instanceof AssetNotFoundError ||
        (error instanceof MemoryLifecycleError && error.code === "NOT_MEMORY");
      return context.json(
        {
          error: {
            code: notFound ? "MEMORY_NOT_FOUND" : "MEMORY_READ_FAILED",
            message:
              error instanceof Error ? error.message : "Memory not found.",
          },
        },
        notFound ? 404 : 500
      );
    }
  });

  app.post("/memory/agent/actions/:id/update", async (context) => {
    const id = context.req.param("id");
    const formData = await context.req.formData();
    const parsed = memoryManagementUpdateSchema.safeParse({
      scopeId: formData.get("scopeId"),
      contextKey: formData.get("contextKey"),
      title: formData.get("title"),
      content: formData.get("content"),
    });

    if (!id || !parsed.success) {
      const message = encodeURIComponent("请提供有效的新版本内容。");
      return context.redirect(
        `/memory/agent/${id ?? ""}?error=${message}`,
        303
      );
    }

    try {
      const result = await updateMemory(context.env, {
        id,
        ...parsed.data,
      });
      return context.redirect(
        `/memory/agent/${result.current.id}?updated=1`,
        303
      );
    } catch (error) {
      const message = encodeURIComponent(
        error instanceof Error ? error.message : "创建新版本失败。"
      );
      return context.redirect(`/memory/agent/${id}?error=${message}`, 303);
    }
  });

  app.post("/memory/agent/actions/:id/forget", async (context) => {
    const id = context.req.param("id");
    const formData = await context.req.formData();
    const parsed = memoryManagementTargetSchema.safeParse({
      scopeId: formData.get("scopeId"),
      contextKey: formData.get("contextKey"),
    });

    if (!id || !parsed.success) {
      const message = encodeURIComponent("记忆归属参数无效。");
      return context.redirect(
        `/memory/agent/${id ?? ""}?error=${message}`,
        303
      );
    }

    try {
      await forgetMemory(context.env, { id, ...parsed.data });
      return context.redirect(`/memory/agent/${id}?forgotten=1`, 303);
    } catch (error) {
      const message = encodeURIComponent(
        error instanceof Error ? error.message : "遗忘记忆失败。"
      );
      return context.redirect(`/memory/agent/${id}?error=${message}`, 303);
    }
  });

  app.post("/memory/agent/actions/:id/restore", async (context) => {
    const id = context.req.param("id");
    const formData = await context.req.formData();
    const parsed = memoryManagementTargetSchema.safeParse({
      scopeId: formData.get("scopeId"),
      contextKey: formData.get("contextKey"),
    });

    if (!id || !parsed.success) {
      const message = encodeURIComponent("记忆归属参数无效。");
      return context.redirect(
        `/memory/agent/${id ?? ""}?error=${message}`,
        303
      );
    }

    try {
      await restoreMemory(context.env, { id, ...parsed.data });
      return context.redirect(`/memory/agent/${id}?restored=1`, 303);
    } catch (error) {
      const message = encodeURIComponent(
        error instanceof Error ? error.message : "恢复记忆失败。"
      );
      return context.redirect(`/memory/agent/${id}?error=${message}`, 303);
    }
  });
};
