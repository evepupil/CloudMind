import type { Hono } from "hono";
import type { z } from "zod";

import { AssetNotFoundError } from "@/core/assets/errors";
import type { AppEnv } from "@/env";
import { assetIdParamsSchema } from "@/features/assets/server/schemas";
import { ingestTextPayloadSchema, ingestUrlPayloadSchema } from "./schemas";
import {
  ingestFileAsset,
  ingestTextAsset,
  ingestUrlAsset,
  reprocessAsset,
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

const parseFileUploadFormData = (
  formData: FormData
):
  | {
      ok: true;
      data: {
        title?: string | undefined;
        file: File;
      };
    }
  | {
      ok: false;
      message: string;
      validationError?: z.ZodError | undefined;
    } => {
  const titleValue = formData.get("title");
  const parsedTitle = ingestTextPayloadSchema.pick({ title: true }).safeParse({
    title: typeof titleValue === "string" ? titleValue : undefined,
  });

  if (!parsedTitle.success) {
    return {
      ok: false,
      message: "Please provide a valid title.",
      validationError: parsedTitle.error,
    };
  }

  const fileValue = formData.get("file");

  if (fileValue === null || typeof fileValue === "string") {
    return {
      ok: false,
      message: "File is required.",
    };
  }

  const file = fileValue as File;

  if (file.size === 0) {
    return {
      ok: false,
      message: "File must not be empty.",
    };
  }

  if (!isPdfFile(file)) {
    return {
      ok: false,
      message: "Only PDF files are supported right now.",
    };
  }

  return {
    ok: true,
    data: {
      title: parsedTitle.data.title,
      file,
    },
  };
};

// 这里注册采集与重处理相关 API，和资产查询路由分离。
export const registerIngestRoutes = (app: Hono<AppEnv>): void => {
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
    const parsedFormData = parseFileUploadFormData(formData);

    if (!parsedFormData.ok) {
      if (parsedFormData.validationError) {
        return context.json(
          getValidationErrorBody(parsedFormData.validationError),
          400
        );
      }

      return context.json(getInvalidInputBody(parsedFormData.message), 400);
    }

    const item = await ingestFileAsset(context.env, {
      title: parsedFormData.data.title,
      file: parsedFormData.data.file,
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

  app.post("/assets/actions/ingest-file", async (context) => {
    const formData = await context.req.formData();
    const parsedFormData = parseFileUploadFormData(formData);

    if (!parsedFormData.ok) {
      return context.redirect(
        `/assets?error=${encodeURIComponent(parsedFormData.message)}`
      );
    }

    const item = await ingestFileAsset(context.env, parsedFormData.data);

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
