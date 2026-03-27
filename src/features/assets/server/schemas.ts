import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed.length === 0 ? undefined : trimmed;
};

const rawCreatedAtFilterSchema = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().optional()
);

export const timezoneOffsetMinutesSchema = z.coerce
  .number()
  .int()
  .min(-840)
  .max(840)
  .optional();

const isoDatetimeWithOffsetSchema = z.string().datetime({ offset: true });
const dateOnlyFilterPattern = /^\d{4}-\d{2}-\d{2}$/;

const validateCreatedAtFilter = (
  value: string | undefined,
  fieldName: "createdAtFrom" | "createdAtTo",
  timezoneOffsetMinutes: number | undefined,
  context: z.RefinementCtx
) => {
  if (!value) {
    return;
  }

  if (dateOnlyFilterPattern.test(value)) {
    if (timezoneOffsetMinutes === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [fieldName],
        message:
          "timezoneOffsetMinutes is required when using YYYY-MM-DD date filters",
      });
    }

    return;
  }

  const parsed = isoDatetimeWithOffsetSchema.safeParse(value);

  if (!parsed.success) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [fieldName],
      message:
        "Created-at filters must be YYYY-MM-DD with timezoneOffsetMinutes or an ISO datetime with offset",
    });
  }
};

const normalizeDateFilter = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  return value;
};

const normalizeDateOnlyFilter = (
  value: string | undefined,
  boundary: "start" | "end",
  timezoneOffsetMinutes: number | undefined
): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (!dateOnlyFilterPattern.test(value)) {
    return normalizeDateFilter(value);
  }

  if (timezoneOffsetMinutes === undefined) {
    return value;
  }

  const [rawYear = "", rawMonth = "", rawDay = ""] = value.split("-");
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);

  if ([year, month, day].some((part) => Number.isNaN(part))) {
    return value;
  }

  const hour = boundary === "start" ? 0 : 23;
  const minute = boundary === "start" ? 0 : 59;
  const second = boundary === "start" ? 0 : 59;
  const millisecond = boundary === "start" ? 0 : 999;
  const utcTimestamp =
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond) +
    timezoneOffsetMinutes * 60 * 1000;

  return new Date(utcTimestamp).toISOString();
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

const assetDeletedFilterSchema = z.enum(["exclude", "only", "include"]);

const assetListRawQuerySchema = z.object({
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
  timezoneOffsetMinutes: z.preprocess(
    emptyStringToUndefined,
    timezoneOffsetMinutesSchema
  ),
  createdAtFrom: rawCreatedAtFilterSchema,
  createdAtTo: rawCreatedAtFilterSchema,
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

export const assetListQuerySchema = assetListRawQuerySchema
  .superRefine((value, context) => {
    validateCreatedAtFilter(
      value.createdAtFrom,
      "createdAtFrom",
      value.timezoneOffsetMinutes,
      context
    );
    validateCreatedAtFilter(
      value.createdAtTo,
      "createdAtTo",
      value.timezoneOffsetMinutes,
      context
    );
  })
  .transform((value) => ({
    ...value,
    createdAtFrom: normalizeDateOnlyFilter(
      value.createdAtFrom,
      "start",
      value.timezoneOffsetMinutes
    ),
    createdAtTo: normalizeDateOnlyFilter(
      value.createdAtTo,
      "end",
      value.timezoneOffsetMinutes
    ),
  }));

export {
  rawCreatedAtFilterSchema as createdAtFilterInputSchema,
  validateCreatedAtFilter,
  normalizeDateOnlyFilter,
};

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
