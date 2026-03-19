import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { assets } from "./assets";

// 这里记录正文切块后的检索单元元数据，为后续向量检索和问答召回做准备。
export const assetChunks = sqliteTable(
  "asset_chunks",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, {
        onDelete: "cascade",
      }),
    chunkIndex: integer("chunk_index").notNull(),
    textPreview: text("text_preview").notNull(),
    vectorId: text("vector_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("asset_chunks_asset_id_idx").on(table.assetId),
    index("asset_chunks_asset_id_chunk_index_idx").on(
      table.assetId,
      table.chunkIndex
    ),
    index("asset_chunks_vector_id_idx").on(table.vectorId),
  ]
);
