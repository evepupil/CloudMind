import type { Hono } from "hono";
import type { z } from "zod";

import { AssetNotFoundError } from "@/core/assets/errors";
import { WorkflowRunNotFoundError } from "@/core/workflows/errors";
import type { AppEnv } from "@/env";
import {
  getWorkflowRunDetail,
  listWorkflowRunsByAssetId,
} from "@/features/workflows/server/service";

import {
  assetIdParamsSchema,
  assetListQuerySchema,
  assetUpdatePayloadSchema,
} from "./schemas";
import { deleteAsset, getAssetById, listAssets, restoreAsset, updateAsset } from "./service";

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

  app.patch("/api/assets/:id", async (context) => {
    const parsedParams = assetIdParamsSchema.safeParse(context.req.param());

    if (!parsedParams.success) {
      return context.json(getValidationErrorBody(parsedParams.error), 400);
    }

    const rawPayload = await context.req.json().catch(() => null);
    const parsedPayload = assetUpdatePayloadSchema.safeParse(rawPayload);

    if (!parsedPayload.success) {
      return context.json(getValidationErrorBody(parsedPayload.error), 400);
    }

    try {
      const item = await updateAsset(
        context.env,
        parsedParams.data.id,
        parsedPayload.data
      );

      return context.json({
        ok: true,
        item,
      });
    } catch (error) {
      if (error instanceof AssetNotFoundError) {
        return context.json(getAssetNotFoundBody(), 404);
      }

      throw error;
    }
  });

  app.delete("/api/assets/:id", async (context) => {
    const parsedParams = assetIdParamsSchema.safeParse(context.req.param());

    if (!parsedParams.success) {
      return context.json(getValidationErrorBody(parsedParams.error), 400);
    }

    try {
      await deleteAsset(context.env, parsedParams.data.id);

      return context.json({
        ok: true,
      });
    } catch (error) {
      if (error instanceof AssetNotFoundError) {
        return context.json(getAssetNotFoundBody(), 404);
      }

      throw error;
    }
  });

  app.post("/api/assets/:id/restore", async (context) => {
    const parsedParams = assetIdParamsSchema.safeParse(context.req.param());

    if (!parsedParams.success) {
      return context.json(getValidationErrorBody(parsedParams.error), 400);
    }

    try {
      const item = await restoreAsset(context.env, parsedParams.data.id);

      return context.json({
        ok: true,
        item,
      });
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

  app.post("/assets/actions/:id/update", async (context) => {
    const parsedParams = assetIdParamsSchema.safeParse(context.req.param());

    if (!parsedParams.success) {
      return context.redirect(
        `/assets?error=${encodeURIComponent("Invalid asset id.")}`
      );
    }

    const formData = await context.req.formData();
    const parsedPayload = assetUpdatePayloadSchema.safeParse({
      title: formData.get("title"),
      summary: formData.get("summary"),
      sourceUrl: formData.get("sourceUrl"),
    });

    if (!parsedPayload.success) {
      return context.redirect(
        `/assets/${parsedParams.data.id}?error=${encodeURIComponent(
          "Please provide valid asset metadata."
        )}`
      );
    }

    try {
      await updateAsset(context.env, parsedParams.data.id, parsedPayload.data);

      return context.redirect(`/assets/${parsedParams.data.id}?updated=1`);
    } catch (error) {
      if (error instanceof AssetNotFoundError) {
        return context.redirect(
          `/assets/${parsedParams.data.id}?error=${encodeURIComponent(
            "Asset not found."
          )}`
        );
      }

      const message =
        error instanceof Error ? error.message : "Failed to update asset.";

      return context.redirect(
        `/assets/${parsedParams.data.id}?error=${encodeURIComponent(message)}`
      );
    }
  });

  app.post("/assets/actions/:id/restore", async (context) => {
    const parsedParams = assetIdParamsSchema.safeParse(context.req.param());

    if (!parsedParams.success) {
      return context.redirect(
        `/assets?error=${encodeURIComponent("Invalid asset id.")}`
      );
    }

    try {
      await restoreAsset(context.env, parsedParams.data.id);

      return context.redirect("/assets?restored=1");
    } catch (error) {
      if (error instanceof AssetNotFoundError) {
        return context.redirect(
          `/assets?error=${encodeURIComponent("Asset not found.")}`
        );
      }

      const message =
        error instanceof Error ? error.message : "Failed to restore asset.";

      return context.redirect(
        `/assets?error=${encodeURIComponent(message)}`
      );
    }
  });

  app.post("/assets/actions/:id/delete", async (context) => {
    const parsedParams = assetIdParamsSchema.safeParse(context.req.param());

    if (!parsedParams.success) {
      return context.redirect(
        `/assets?error=${encodeURIComponent("Invalid asset id.")}`
      );
    }

    try {
      await deleteAsset(context.env, parsedParams.data.id);

      return context.redirect("/assets?deleted=1");
    } catch (error) {
      if (error instanceof AssetNotFoundError) {
        return context.redirect(
          `/assets/${parsedParams.data.id}?error=${encodeURIComponent(
            "Asset not found."
          )}`
        );
      }

      const message =
        error instanceof Error ? error.message : "Failed to delete asset.";

      return context.redirect(
        `/assets/${parsedParams.data.id}?error=${encodeURIComponent(message)}`
      );
    }
  });
};
