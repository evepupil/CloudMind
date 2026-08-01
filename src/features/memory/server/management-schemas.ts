import { z } from "zod";

import { MEMORY_SCOPES } from "@/core/memory/scope";
import { RECORD_KINDS } from "@/core/records/classification";
import {
  contextKeySchema,
  memoryScopeSchema,
  recordKindSchema,
} from "@/core/records/schemas";

const emptyStringToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const firstValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const toOptionalArray = (value: unknown): unknown => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (Array.isArray(value)) {
    const filtered = value.filter(
      (item) => typeof item !== "string" || item.trim().length > 0
    );
    return filtered.length > 0 ? filtered : undefined;
  }

  return [value];
};

export const memoryManagementQuerySchema = z.object({
  recordKinds: z.preprocess(
    toOptionalArray,
    z.array(recordKindSchema).max(RECORD_KINDS.length).optional()
  ),
  scopeIds: z.preprocess(
    toOptionalArray,
    z.array(memoryScopeSchema).max(MEMORY_SCOPES.length).optional()
  ),
  contextKeys: z.preprocess(
    toOptionalArray,
    z.array(contextKeySchema).max(20).optional()
  ),
  deleted: z.preprocess(
    (value) => emptyStringToUndefined(firstValue(value)),
    z.enum(["exclude", "only", "include"]).optional()
  ),
  query: z.preprocess(
    (value) => emptyStringToUndefined(firstValue(value)),
    z.string().trim().max(200).optional()
  ),
  page: z.preprocess(
    firstValue,
    z.coerce.number().int().min(1).max(9999).optional()
  ),
  pageSize: z.preprocess(
    firstValue,
    z.coerce.number().int().min(1).max(100).optional()
  ),
});

export const memoryBrowseQuerySchema = z.object({
  contextKey: z.preprocess(
    (value) => emptyStringToUndefined(firstValue(value)),
    contextKeySchema.optional()
  ),
});

export const memoryManagementTargetSchema = z.object({
  scopeId: memoryScopeSchema,
  contextKey: contextKeySchema,
});

export const memoryManagementUpdateSchema = memoryManagementTargetSchema.extend(
  {
    title: z.string().trim().min(1).max(300).optional(),
    content: z.string().trim().min(1).max(20000),
  }
);

export type MemoryManagementQuery = z.infer<typeof memoryManagementQuerySchema>;
