import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? undefined : trimmed;
};

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

export const assetListQuerySchema = z.object({
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
  sourceHost: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(200, "Source host is too long").optional()
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
