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
  sourceKind: assetSourceKindSchema.optional(),
  timezoneOffsetMinutes: timezoneOffsetMinutesSchema,
  createdAtFrom: createdAtFilterInputSchema,
  createdAtTo: createdAtFilterInputSchema,
  sourceHost: z.string().trim().min(1).max(200).optional(),
  topic: z.string().trim().min(1).max(120).optional(),
  tag: z.string().trim().min(1).max(120).optional(),
  collection: z.string().trim().min(1).max(120).optional(),
});

export const normalizeCreatedAtFilters = <
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

export const validateCreatedAtFilters = (
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

// 不带 .transform() 的原始 payload schema：MCP inputSchema 直接用它（或 .extend 后用），
// 这样对外暴露的 JSON schema 保留 properties（带 transform 会退化为空 object，桥接层就不知道
// queries/数组字段的形状）。规范化(normalize)改由 MCP handler 显式调用 normalizeCreatedAtFilters。
export const assetSearchPayloadRawSchema = assetSearchFiltersRawSchema.extend({
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
