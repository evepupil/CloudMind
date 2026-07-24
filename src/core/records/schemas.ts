import { z } from "zod";

import { MEMORY_SCOPES } from "@/core/memory/scope";

import {
  GLOBAL_CONTEXT_KEY,
  isValidContextKey,
  RECORD_KINDS,
} from "./classification";

export const recordKindSchema = z.enum(RECORD_KINDS);
export const memoryScopeSchema = z.enum(MEMORY_SCOPES);

export const contextKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine(isValidContextKey, {
    message: `Context key must be "${GLOBAL_CONTEXT_KEY}" or start with "project:"`,
  });

export const recordFilterSchemaShape = {
  recordKind: recordKindSchema
    .optional()
    .describe("Legacy single-value record kind filter."),
  recordKinds: z
    .array(recordKindSchema)
    .max(RECORD_KINDS.length)
    .optional()
    .describe("Record kinds to match with OR semantics."),
  scopeId: memoryScopeSchema
    .optional()
    .describe("Legacy single-value memory scope filter."),
  scopeIds: z
    .array(memoryScopeSchema)
    .max(MEMORY_SCOPES.length)
    .optional()
    .describe("Memory scopes to match with OR semantics."),
  contextKey: contextKeySchema
    .optional()
    .describe("Legacy single-value context filter."),
  contextKeys: z
    .array(contextKeySchema)
    .max(20)
    .optional()
    .describe("Context keys to match with OR semantics."),
};

export const validateRecordFilterConflicts = (
  value: {
    recordKind?: string | undefined;
    recordKinds?: readonly string[] | undefined;
    scopeId?: string | undefined;
    scopeIds?: readonly string[] | undefined;
    contextKey?: string | undefined;
    contextKeys?: readonly string[] | undefined;
  },
  context: z.RefinementCtx
): void => {
  for (const [singularKey, pluralKey] of [
    ["recordKind", "recordKinds"],
    ["scopeId", "scopeIds"],
    ["contextKey", "contextKeys"],
  ] as const) {
    if (value[singularKey] !== undefined && value[pluralKey] !== undefined) {
      context.addIssue({
        code: "custom",
        message: `Fields "${singularKey}" and "${pluralKey}" cannot be used together.`,
        path: [pluralKey],
      });
    }
  }
};
