import { z } from "zod";

export const assetSearchPayloadSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Query is required")
    .max(200, "Query is too long"),
  page: z.number().int().min(1).max(9999).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

export type AssetSearchPayload = z.infer<typeof assetSearchPayloadSchema>;
