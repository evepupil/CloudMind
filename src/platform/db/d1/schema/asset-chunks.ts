import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { assets } from "./assets";

const recordKindValues = ["library", "memory"] as const;

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
    recordKind: text("record_kind", { enum: recordKindValues })
      .notNull()
      .default("library"),
    scopeId: text("scope_id").notNull().default("personal"),
    contextKey: text("context_key").notNull().default("global"),
    chunkIndex: integer("chunk_index").notNull(),
    textPreview: text("text_preview").notNull(),
    contentText: text("content_text").notNull().default(""),
    vectorId: text("vector_id"),
    // 这里记录 chunk 文本的内容哈希与所用嵌入模型/维度，支撑增量重嵌与模型迁移。
    contentHash: text("content_hash"),
    embeddingModel: text("embedding_model"),
    embeddingDim: integer("embedding_dim"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("asset_chunks_asset_id_idx").on(table.assetId),
    index("asset_chunks_record_scope_context_idx").on(
      table.recordKind,
      table.scopeId,
      table.contextKey
    ),
    index("asset_chunks_asset_id_chunk_index_idx").on(
      table.assetId,
      table.chunkIndex
    ),
    index("asset_chunks_vector_id_idx").on(table.vectorId),
    index("asset_chunks_asset_id_content_hash_idx").on(
      table.assetId,
      table.contentHash
    ),
  ]
);
