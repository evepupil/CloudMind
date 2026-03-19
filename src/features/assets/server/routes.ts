import type { Hono } from "hono";
import type { z } from "zod";

import type { AppEnv } from "@/env";

import { AssetNotFoundError } from "./repository";
import {
  assetIdParamsSchema,
  assetListQuerySchema,
  ingestTextPayloadSchema,
  ingestUrlPayloadSchema,
} from "./schemas";
import {
  getAssetById,
  ingestTextAsset,
  ingestUrlAsset,
  listAssets,
} from "./service";

const getValidationErrorBody = (error: z.ZodError) => {
  return {
    error: {
      code: "INVALID_INPUT",
      message: "Invalid request payload",
      details: error.flatten(),
    },
  };
};

// 这里注册资产相关 API，为后续知识库入口预留统一路径。
export const registerAssetRoutes = (app: Hono<AppEnv>): void => {
  app.get("/api/assets", async (context) => {
    const parsedQuery = assetListQuerySchema.safeParse(context.req.query());

    if (!parsedQuery.success) {
      return context.json(getValidationErrorBody(parsedQuery.error), 400);
    }

    const items = await listAssets(context.env, parsedQuery.data);

    return context.json({ items });
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
        return context.json(
          {
            error: {
              code: "ASSET_NOT_FOUND",
              message: "Asset not found",
            },
          },
          404
        );
      }

      throw error;
    }
  });

  app.post("/api/ingest/text", async (context) => {
    const rawPayload = await context.req.json().catch(() => null);
    const parsedPayload = ingestTextPayloadSchema.safeParse(rawPayload);

    if (!parsedPayload.success) {
      return context.json(getValidationErrorBody(parsedPayload.error), 400);
    }

    const item = await ingestTextAsset(context.env, parsedPayload.data);

    return context.json(
      {
        ok: true,
        item: {
          id: item.id,
          type: item.type,
          title: item.title,
          status: item.status,
          createdAt: item.createdAt,
        },
      },
      201
    );
  });

  app.post("/api/ingest/url", async (context) => {
    const rawPayload = await context.req.json().catch(() => null);
    const parsedPayload = ingestUrlPayloadSchema.safeParse(rawPayload);

    if (!parsedPayload.success) {
      return context.json(getValidationErrorBody(parsedPayload.error), 400);
    }

    const item = await ingestUrlAsset(context.env, parsedPayload.data);

    return context.json(
      {
        ok: true,
        item: {
          id: item.id,
          type: item.type,
          title: item.title,
          status: item.status,
          createdAt: item.createdAt,
        },
      },
      201
    );
  });

  app.post("/assets/actions/ingest-text", async (context) => {
    const formData = await context.req.formData();
    const parsedPayload = ingestTextPayloadSchema.safeParse({
      title: formData.get("title"),
      content: formData.get("content"),
    });

    if (!parsedPayload.success) {
      return context.redirect(
        `/assets?error=${encodeURIComponent("请输入标题或正文格式正确的文本资产。")}`
      );
    }

    const item = await ingestTextAsset(context.env, parsedPayload.data);

    return context.redirect(`/assets/${item.id}?created=1`);
  });

  app.post("/assets/actions/ingest-url", async (context) => {
    const formData = await context.req.formData();
    const parsedPayload = ingestUrlPayloadSchema.safeParse({
      title: formData.get("title"),
      url: formData.get("url"),
    });

    if (!parsedPayload.success) {
      return context.redirect(
        `/assets?error=${encodeURIComponent("请输入格式正确的 URL 资产。")}`
      );
    }

    const item = await ingestUrlAsset(context.env, parsedPayload.data);

    return context.redirect(`/assets/${item.id}?created=1`);
  });
};
