import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { assets } from "./assets";

const assetSourceKindValues = [
  "manual",
  "browser_extension",
  "upload",
  "mcp",
  "import",
] as const;

// 这里单独存来源信息，避免把所有入口元数据都堆进 assets 主表。
export const assetSources = sqliteTable(
  "asset_sources",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, {
        onDelete: "cascade",
      }),
    kind: text("kind", { enum: assetSourceKindValues }).notNull(),
    sourceUrl: text("source_url"),
    metadataJson: text("metadata_json"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("asset_sources_asset_id_idx").on(table.assetId),
    index("asset_sources_kind_idx").on(table.kind),
  ]
);
