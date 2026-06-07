import { z } from "zod";

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

export const backfillChunkContentPayloadSchema = z.object({
  dryRun: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export type IngestTextPayload = z.infer<typeof ingestTextPayloadSchema>;
export type IngestUrlPayload = z.infer<typeof ingestUrlPayloadSchema>;
export type BackfillChunkContentPayload = z.infer<
  typeof backfillChunkContentPayloadSchema
>;
