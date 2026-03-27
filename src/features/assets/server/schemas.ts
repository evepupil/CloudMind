import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? undefined : trimmed;
};

const normalizeDateFilter = (
  value: unknown,
  boundary: "start" | "end"
): unknown => {
  const normalized = emptyStringToUndefined(value);

  if (typeof normalized !== "string") {
    return normalized;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const suffix =
      boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";

    return `${normalized}${suffix}`;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  return parsed.toISOString();
};

export const createdAtFromFilterSchema = z.preprocess(
  (value) => normalizeDateFilter(value, "start"),
  z.string().datetime({ offset: true }).optional()
);

export const createdAtToFilterSchema = z.preprocess(
  (value) => normalizeDateFilter(value, "end"),
  z.string().datetime({ offset: true }).optional()
);

export const assetIdParamsSchema = z.object({
  id: z.string().trim().min(1, "Asset id is required"),
});

const assetStatusSchema = z.enum(["pending", "processing", "ready", "failed"]);
const assetTypeSchema = z.enum(["url", "pdf", "note", "image", "chat"]);
const assetDomainSchema = z.enum([
  "engineering",
  "product",
  "research",
  "personal",
  "finance",
  "health",
  "archive",
  "general",
]);
const assetDocumentClassSchema = z.enum([
  "reference_doc",
  "design_doc",
  "bug_note",
  "paper",
  "journal_entry",
  "meeting_note",
  "spec",
  "howto",
  "general_note",
]);
const assetSourceKindSchema = z.enum([
  "manual",
  "browser_extension",
  "upload",
  "mcp",
  "import",
]);
const assetAiVisibilitySchema = z.enum(["allow", "summary_only", "deny"]);

const assetDeletedFilterSchema = z.enum(["exclude", "only", "include"]);

export const assetListQuerySchema = z.object({
  deleted: z.preprocess(
    emptyStringToUndefined,
    assetDeletedFilterSchema.optional()
  ),
  status: z.preprocess(emptyStringToUndefined, assetStatusSchema.optional()),
  type: z.preprocess(emptyStringToUndefined, assetTypeSchema.optional()),
  domain: z.preprocess(emptyStringToUndefined, assetDomainSchema.optional()),
  documentClass: z.preprocess(
    emptyStringToUndefined,
    assetDocumentClassSchema.optional()
  ),
  sourceKind: z.preprocess(
    emptyStringToUndefined,
    assetSourceKindSchema.optional()
  ),
  aiVisibility: z.preprocess(
    emptyStringToUndefined,
    assetAiVisibilitySchema.optional()
  ),
  createdAtFrom: createdAtFromFilterSchema,
  createdAtTo: createdAtToFilterSchema,
  sourceHost: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(200, "Source host is too long").optional()
  ),
  topic: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(120, "Topic is too long").optional()
  ),
  tag: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(120, "Tag is too long").optional()
  ),
  collection: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(120, "Collection is too long").optional()
  ),
  query: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(200, "Query is too long").optional()
  ),
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
