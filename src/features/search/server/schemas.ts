import { z } from "zod";

import {
  createdAtFilterInputSchema,
  normalizeDateOnlyFilter,
  timezoneOffsetMinutesSchema,
  validateCreatedAtFilter,
} from "@/features/assets/server/schemas";

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

const assetSearchFiltersRawSchema = z.object({
  type: assetTypeSchema.optional(),
  domain: assetDomainSchema.optional(),
  documentClass: assetDocumentClassSchema.optional(),
  sourceKind: assetSourceKindSchema.optional(),
  timezoneOffsetMinutes: timezoneOffsetMinutesSchema,
  createdAtFrom: createdAtFilterInputSchema,
  createdAtTo: createdAtFilterInputSchema,
  sourceHost: z.string().trim().min(1).max(200).optional(),
  topic: z.string().trim().min(1).max(120).optional(),
  tag: z.string().trim().min(1).max(120).optional(),
  collection: z.string().trim().min(1).max(120).optional(),
});

const normalizeCreatedAtFilters = <
  T extends {
    timezoneOffsetMinutes?: number | undefined;
    createdAtFrom?: string | undefined;
    createdAtTo?: string | undefined;
  },
>(
  value: T
) => ({
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
});

const validateCreatedAtFilters = (
  value: {
    timezoneOffsetMinutes?: number | undefined;
    createdAtFrom?: string | undefined;
    createdAtTo?: string | undefined;
  },
  context: z.RefinementCtx
) => {
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
};

export const assetSearchFiltersSchema = assetSearchFiltersRawSchema
  .superRefine((value, context) => {
    validateCreatedAtFilters(value, context);
  })
  .transform(normalizeCreatedAtFilters);

const assetSearchPayloadRawSchema = assetSearchFiltersRawSchema.extend({
  query: z
    .string()
    .trim()
    .min(1, "Query is required")
    .max(200, "Query is too long"),
  page: z.number().int().min(1).max(9999).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

export const assetSearchPayloadSchema = assetSearchPayloadRawSchema
  .superRefine((value, context) => {
    validateCreatedAtFilters(value, context);
  })
  .transform(normalizeCreatedAtFilters);

export type AssetSearchPayload = z.infer<typeof assetSearchPayloadSchema>;
