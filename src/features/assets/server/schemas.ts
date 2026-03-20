import { z } from "zod";

export const assetIdParamsSchema = z.object({
  id: z.string().trim().min(1, "Asset id is required"),
});

const assetStatusSchema = z.enum(["pending", "processing", "ready", "failed"]);
const assetTypeSchema = z.enum(["url", "pdf", "note", "image", "chat"]);

export const assetListQuerySchema = z.object({
  status: assetStatusSchema.optional(),
  type: assetTypeSchema.optional(),
  query: z.string().trim().max(200, "Query is too long").optional(),
  page: z.coerce.number().int().min(1).max(9999).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const nullableSummarySchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();

    return trimmed.length === 0 ? null : trimmed;
  },
  z.union([z.string().max(10000, "Summary is too long"), z.null()])
);

const nullableUrlSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();

    return trimmed.length === 0 ? null : trimmed;
  },
  z.union([z.string().url("Source URL must be a valid URL"), z.null()])
);

export const assetUpdatePayloadSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(200, "Title is too long")
      .optional(),
    summary: nullableSummarySchema.optional(),
    sourceUrl: nullableUrlSchema.optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.summary !== undefined ||
      value.sourceUrl !== undefined,
    {
      message: "At least one field must be provided",
    }
  );

export type AssetListQueryInput = z.infer<typeof assetListQuerySchema>;
export type AssetUpdatePayloadInput = z.infer<typeof assetUpdatePayloadSchema>;
