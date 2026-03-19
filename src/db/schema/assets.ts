import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

const assetTypeValues = ["url", "pdf", "note", "image", "chat"] as const;
const assetStatusValues = ["pending", "processing", "ready", "failed"] as const;

// 这里定义资产主表；在接入 R2 前，文本内容先落在 content_text 中避免原文丢失。
export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: assetTypeValues }).notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    sourceUrl: text("source_url"),
    status: text("status", { enum: assetStatusValues }).notNull(),
    contentText: text("content_text"),
    rawR2Key: text("raw_r2_key"),
    contentR2Key: text("content_r2_key"),
    mimeType: text("mime_type"),
    language: text("language"),
    errorMessage: text("error_message"),
    processedAt: text("processed_at"),
    failedAt: text("failed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("assets_status_idx").on(table.status),
    index("assets_type_idx").on(table.type),
    index("assets_created_at_idx").on(table.createdAt),
    index("assets_source_url_idx").on(table.sourceUrl),
  ]
);
