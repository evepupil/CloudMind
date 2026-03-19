import { z } from "zod";

export const assetIdParamsSchema = z.object({
  id: z.string().trim().min(1, "Asset id is required"),
});

export const ingestTextPayloadSchema = z.object({
  title: z.string().trim().max(200, "Title is too long").optional(),
  content: z
    .string()
    .trim()
    .min(1, "Content is required")
    .max(20000, "Content is too long"),
});

export type IngestTextPayload = z.infer<typeof ingestTextPayloadSchema>;
