import type { Hono } from "hono";
import type { z } from "zod";

import { AssetNotFoundError } from "@/core/assets/errors";
import { WorkflowRunNotFoundError } from "@/core/workflows/errors";
import type { AppEnv } from "@/env";
import {
  getWorkflowRunDetail,
  listWorkflowRunsByAssetId,
} from "@/features/workflows/server/service";

import { assetIdParamsSchema, assetListQuerySchema } from "./schemas";
import { getAssetById, listAssets } from "./service";

const getValidationErrorBody = (error: z.ZodError) => {
  return {
    error: {
      code: "INVALID_INPUT",
      message: "Invalid request payload",
      details: error.flatten(),
    },
  };
};

const getAssetNotFoundBody = () => {
  return {
    error: {
      code: "ASSET_NOT_FOUND",
      message: "Asset not found",
    },
  };
};

// 这里注册资产查询相关 API，只负责列表与详情读模型。
export const registerAssetRoutes = (app: Hono<AppEnv>): void => {
  app.get("/api/assets", async (context) => {
    const parsedQuery = assetListQuerySchema.safeParse(context.req.query());

    if (!parsedQuery.success) {
      return context.json(getValidationErrorBody(parsedQuery.error), 400);
    }

    const result = await listAssets(context.env, parsedQuery.data);

    return context.json(result);
  });

  app.get("/api/assets/:id", async (context) => {
    const parsedParams = assetIdParamsSchema.safeParse(context.req.param());

    if (!parsedParams.success) {
      return context.json(getValidationErrorBody(parsedParams.error), 400);
    }

    try {
      const item = await getAssetById(context.env, parsedParams.data.id);

      return context.json({ item });
    } catch (error) {
      if (error instanceof AssetNotFoundError) {
        return context.json(getAssetNotFoundBody(), 404);
      }

      throw error;
    }
  });

  app.get("/api/assets/:id/jobs", async (context) => {
    const parsedParams = assetIdParamsSchema.safeParse(context.req.param());

    if (!parsedParams.success) {
      return context.json(getValidationErrorBody(parsedParams.error), 400);
    }

    try {
      const item = await getAssetById(context.env, parsedParams.data.id);

      return context.json({
        items: item.jobs,
      });
    } catch (error) {
      if (error instanceof AssetNotFoundError) {
        return context.json(getAssetNotFoundBody(), 404);
      }

      throw error;
    }
  });

  app.get("/api/assets/:id/workflows", async (context) => {
    const parsedParams = assetIdParamsSchema.safeParse(context.req.param());

    if (!parsedParams.success) {
      return context.json(getValidationErrorBody(parsedParams.error), 400);
    }

    try {
      await getAssetById(context.env, parsedParams.data.id);

      const items = await listWorkflowRunsByAssetId(
        context.env,
        parsedParams.data.id
      );

      return context.json({ items });
    } catch (error) {
      if (error instanceof AssetNotFoundError) {
        return context.json(getAssetNotFoundBody(), 404);
      }

      throw error;
    }
  });

  app.get("/api/workflows/:id", async (context) => {
    const parsedParams = assetIdParamsSchema.safeParse(context.req.param());

    if (!parsedParams.success) {
      return context.json(getValidationErrorBody(parsedParams.error), 400);
    }

    try {
      const item = await getWorkflowRunDetail(
        context.env,
        parsedParams.data.id
      );

      return context.json({ item });
    } catch (error) {
      if (error instanceof WorkflowRunNotFoundError) {
        return context.json(
          {
            error: {
              code: "WORKFLOW_RUN_NOT_FOUND",
              message: "Workflow run not found",
            },
          },
          404
        );
      }

      throw error;
    }
  });
};
