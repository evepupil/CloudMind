import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const assetTypeValues = ["url", "pdf", "note", "image", "chat"] as const;
const assetStatusValues = ["pending", "processing", "ready", "failed"] as const;
const assetSourceKindValues = [
  "manual",
  "browser_extension",
  "upload",
  "mcp",
  "import",
] as const;
const assetDomainValues = [
  "engineering",
  "product",
  "research",
  "personal",
  "finance",
  "health",
  "archive",
  "general",
] as const;
const assetSensitivityValues = [
  "public",
  "internal",
  "private",
  "restricted",
] as const;
const assetAiVisibilityValues = ["allow", "summary_only", "deny"] as const;

// 这里定义 D1 的资产主表，并补充目录层与 AI 访问策略字段。
export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: assetTypeValues }).notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    sourceUrl: text("source_url"),
    sourceKind: text("source_kind", { enum: assetSourceKindValues }),
    status: text("status", { enum: assetStatusValues }).notNull(),
    domain: text("domain", { enum: assetDomainValues })
      .notNull()
      .default("general"),
    sensitivity: text("sensitivity", { enum: assetSensitivityValues })
      .notNull()
      .default("internal"),
    aiVisibility: text("ai_visibility", { enum: assetAiVisibilityValues })
      .notNull()
      .default("allow"),
    retrievalPriority: integer("retrieval_priority").notNull().default(0),
    collectionKey: text("collection_key"),
    capturedAt: text("captured_at"),
    descriptorJson: text("descriptor_json"),
    contentText: text("content_text"),
    rawR2Key: text("raw_r2_key"),
    contentR2Key: text("content_r2_key"),
    mimeType: text("mime_type"),
    language: text("language"),
    errorMessage: text("error_message"),
    processedAt: text("processed_at"),
    failedAt: text("failed_at"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("assets_status_idx").on(table.status),
    index("assets_type_idx").on(table.type),
    index("assets_source_kind_idx").on(table.sourceKind),
    index("assets_domain_idx").on(table.domain),
    index("assets_sensitivity_idx").on(table.sensitivity),
    index("assets_collection_key_idx").on(table.collectionKey),
    index("assets_created_at_idx").on(table.createdAt),
    index("assets_captured_at_idx").on(table.capturedAt),
    index("assets_source_url_idx").on(table.sourceUrl),
    index("assets_deleted_at_idx").on(table.deletedAt),
    index("assets_domain_status_deleted_at_idx").on(
      table.domain,
      table.status,
      table.deletedAt
    ),
    index("assets_collection_captured_deleted_at_idx").on(
      table.collectionKey,
      table.capturedAt,
      table.deletedAt
    ),
  ]
);
