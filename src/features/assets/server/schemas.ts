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

export const ingestTextPayloadSchema = z.object({
  title: z.string().trim().max(200, "Title is too long").optional(),
  content: z
    .string()
    .trim()
    .min(1, "Content is required")
    .max(20000, "Content is too long"),
});

export const ingestUrlPayloadSchema = z.object({
  title: z.string().trim().max(200, "Title is too long").optional(),
  url: z.url("A valid URL is required").max(2000, "URL is too long"),
});

export const assetSearchPayloadSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Query is required")
    .max(200, "Query is too long"),
  page: z.number().int().min(1).max(9999).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

export type AssetListQueryInput = z.infer<typeof assetListQuerySchema>;
export type IngestTextPayload = z.infer<typeof ingestTextPayloadSchema>;
export type IngestUrlPayload = z.infer<typeof ingestUrlPayloadSchema>;
