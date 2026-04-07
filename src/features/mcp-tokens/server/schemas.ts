import { z } from "zod";

export const createMcpTokenPayloadSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const mcpTokenIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});
