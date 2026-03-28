import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { assets } from "./assets";

const assetAssertionKindValues = [
  "fact",
  "decision",
  "constraint",
  "summary_point",
] as const;

// 这里存资产级高价值断言，为结构化检索和问答提供更稳的结论层。
export const assetAssertions = sqliteTable(
  "asset_assertions",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, {
        onDelete: "cascade",
      }),
    assertionIndex: integer("assertion_index").notNull(),
    kind: text("kind", { enum: assetAssertionKindValues }).notNull(),
    text: text("text").notNull(),
    sourceChunkIndex: integer("source_chunk_index"),
    sourceSpanJson: text("source_span_json"),
    confidence: real("confidence"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("asset_assertions_asset_id_idx").on(table.assetId),
    index("asset_assertions_asset_id_index_idx").on(
      table.assetId,
      table.assertionIndex
    ),
    index("asset_assertions_kind_idx").on(table.kind),
  ]
);
