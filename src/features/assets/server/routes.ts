import type { Hono } from "hono";
import type { z } from "zod";

import type { AppEnv } from "@/env";

import { AssetNotFoundError } from "./repository";
import {
  assetIdParamsSchema,
  assetListQuerySchema,
  assetSearchPayloadSchema,
  ingestTextPayloadSchema,
  ingestUrlPayloadSchema,
} from "./schemas";
import {
  getAssetById,
  ingestFileAsset,
  ingestTextAsset,
  ingestUrlAsset,
  listAssets,
  reprocessAsset,
  searchAssets,
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

const getAssetNotFoundBody = () => {
  return {
    error: {
      code: "ASSET_NOT_FOUND",
      message: "Asset not found",
    },
  };
};

const getInvalidInputBody = (message: string) => {
  return {
    error: {
      code: "INVALID_INPUT",
      message,
    },
  };
};

const isPdfFile = (file: File): boolean => {
  if (file.type === "application/pdf") {
    return true;
  }

  return file.name.toLowerCase().endsWith(".pdf");
};

// 这里注册资产相关 API，并补上页面表单 action，保持 Web UI 和 API 走同一套 service。
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

  app.post("/api/ingest/file", async (context) => {
    const formData = await context.req.formData();
    const titleValue = formData.get("title");
    const parsedTitle = ingestTextPayloadSchema
      .pick({ title: true })
      .safeParse({
        title: typeof titleValue === "string" ? titleValue : undefined,
      });

    if (!parsedTitle.success) {
      return context.json(getValidationErrorBody(parsedTitle.error), 400);
    }

    const fileValue = formData.get("file");

    if (fileValue === null || typeof fileValue === "string") {
      return context.json(getInvalidInputBody("File is required."), 400);
    }

    const file = fileValue as File;

    if (file.size === 0) {
      return context.json(getInvalidInputBody("File must not be empty."), 400);
    }

    if (!isPdfFile(file)) {
      return context.json(
        getInvalidInputBody("Only PDF files are supported right now."),
        400
      );
    }

    const item = await ingestFileAsset(context.env, {
      title: parsedTitle.data.title,
      file,
    });

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

  app.post("/api/assets/:id/process", async (context) => {
    const parsedParams = assetIdParamsSchema.safeParse(context.req.param());

    if (!parsedParams.success) {
      return context.json(getValidationErrorBody(parsedParams.error), 400);
    }

    try {
      const item = await reprocessAsset(context.env, parsedParams.data.id);

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

  app.post("/api/search", async (context) => {
    const rawPayload = await context.req.json().catch(() => null);
    const parsedPayload = assetSearchPayloadSchema.safeParse(rawPayload);

    if (!parsedPayload.success) {
      return context.json(getValidationErrorBody(parsedPayload.error), 400);
    }

    const result = await searchAssets(context.env, parsedPayload.data);

    return context.json(result);
  });

  app.post("/assets/actions/ingest-text", async (context) => {
    const formData = await context.req.formData();
    const parsedPayload = ingestTextPayloadSchema.safeParse({
      title: formData.get("title"),
      content: formData.get("content"),
    });

    if (!parsedPayload.success) {
      return context.redirect(
        `/assets?error=${encodeURIComponent(
          "Please provide valid text content."
        )}`
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
        `/assets?error=${encodeURIComponent("Please provide a valid URL.")}`
      );
    }

    const item = await ingestUrlAsset(context.env, parsedPayload.data);

    return context.redirect(`/assets/${item.id}?created=1`);
  });

  app.post("/assets/actions/:id/process", async (context) => {
    const parsedParams = assetIdParamsSchema.safeParse(context.req.param());

    if (!parsedParams.success) {
      return context.redirect(
        `/assets?error=${encodeURIComponent("Invalid asset id.")}`
      );
    }

    try {
      await reprocessAsset(context.env, parsedParams.data.id);

      return context.redirect(`/assets/${parsedParams.data.id}?reprocessed=1`);
    } catch (error) {
      if (error instanceof AssetNotFoundError) {
        return context.redirect(
          `/assets/${parsedParams.data.id}?error=${encodeURIComponent(
            "Asset not found."
          )}`
        );
      }

      const message =
        error instanceof Error ? error.message : "Failed to reprocess asset.";

      return context.redirect(
        `/assets/${parsedParams.data.id}?error=${encodeURIComponent(message)}`
      );
    }
  });
};
