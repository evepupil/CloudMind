import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { assets } from "./assets";

const assetFacetKeyValues = [
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

// 这里存资产的多值切面，支撑筛选、聚合与浏览入口动态生成。
export const assetFacets = sqliteTable(
  "asset_facets",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, {
        onDelete: "cascade",
      }),
    facetKey: text("facet_key", { enum: assetFacetKeyValues }).notNull(),
    facetValue: text("facet_value").notNull(),
    facetLabel: text("facet_label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("asset_facets_asset_id_idx").on(table.assetId),
    index("asset_facets_key_value_idx").on(table.facetKey, table.facetValue),
    index("asset_facets_key_value_asset_id_idx").on(
      table.facetKey,
      table.facetValue,
      table.assetId
    ),
  ]
);
