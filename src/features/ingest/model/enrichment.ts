import { z } from "zod";

export const assetDomainValues = [
  "engineering",
  "product",
  "research",
  "personal",
  "finance",
  "health",
  "archive",
  "general",
] as const;

export const assetDocumentClassValues = [
  "reference_doc",
  "design_doc",
  "bug_note",
  "paper",
  "journal_entry",
  "meeting_note",
  "spec",
  "howto",
  "general_note",
] as const;

export const assetFacetKeyValues = [
  "domain",
  "document_class",
  "asset_type",
  "source_kind",
  "collection",
  "source_host",
  "year",
  "topic",
  "tag",
  "ai_visibility",
  "sensitivity",
] as const;

const enrichmentDescriptorSchema = z.object({
  topics: z
    .array(z.string().trim().min(1).max(80))
    .max(12)
    .optional()
    .describe("Optional descriptor topics to prioritize for indexing."),
  tags: z
    .array(z.string().trim().min(1).max(80))
    .max(12)
    .optional()
    .describe("Optional descriptor tags to prioritize for indexing."),
  collectionKey: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional()
    .describe("Optional collection key such as journal/2026/03."),
  signals: z
    .array(z.string().trim().min(1).max(80))
    .max(12)
    .optional()
    .describe("Optional heuristic signals or keywords to preserve."),
});

const enrichmentFacetSchema = z.object({
  facetKey: z
    .enum(assetFacetKeyValues)
    .describe(`Allowed facet keys: ${assetFacetKeyValues.join(", ")}.`),
  facetValue: z.string().trim().min(1).max(120),
  facetLabel: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export const textAssetEnrichmentSchema = z.object({
  summary: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .optional()
    .describe("Optional pre-written summary to use if it is valid."),
  domain: z
    .enum(assetDomainValues)
    .optional()
    .describe(`Allowed domain values: ${assetDomainValues.join(", ")}.`),
  documentClass: z
    .enum(assetDocumentClassValues)
    .optional()
    .describe(
      `Allowed documentClass values: ${assetDocumentClassValues.join(", ")}.`
    ),
  descriptor: enrichmentDescriptorSchema
    .optional()
    .describe(
      "Optional descriptor overrides such as topics, collectionKey, and signals."
    ),
  facets: z
    .array(enrichmentFacetSchema)
    .max(20)
    .optional()
    .describe(
      "Optional precomputed facets that already match CloudMind facet enums."
    ),
});

export type TextAssetEnrichmentInput = z.infer<
  typeof textAssetEnrichmentSchema
>;
