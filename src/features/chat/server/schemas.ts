import { z } from "zod";

export const askLibraryPayloadSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Question is required")
    .max(2_000, "Question is too long"),
  topK: z.number().int().min(1).max(10).optional(),
});

export type AskLibraryPayload = z.infer<typeof askLibraryPayloadSchema>;
