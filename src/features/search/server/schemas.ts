import { z } from "zod";

import {
  createdAtFromFilterSchema,
  createdAtToFilterSchema,
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

export const assetSearchFiltersSchema = z.object({
  type: assetTypeSchema.optional(),
  domain: assetDomainSchema.optional(),
  documentClass: assetDocumentClassSchema.optional(),
  sourceKind: assetSourceKindSchema.optional(),
  createdAtFrom: createdAtFromFilterSchema,
  createdAtTo: createdAtToFilterSchema,
  sourceHost: z.string().trim().min(1).max(200).optional(),
  topic: z.string().trim().min(1).max(120).optional(),
  tag: z.string().trim().min(1).max(120).optional(),
  collection: z.string().trim().min(1).max(120).optional(),
});

export const assetSearchPayloadSchema = assetSearchFiltersSchema.extend({
  query: z
    .string()
    .trim()
    .min(1, "Query is required")
    .max(200, "Query is too long"),
  page: z.number().int().min(1).max(9999).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

export type AssetSearchPayload = z.infer<typeof assetSearchPayloadSchema>;
