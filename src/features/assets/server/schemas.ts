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

export type AssetListQueryInput = z.infer<typeof assetListQuerySchema>;
