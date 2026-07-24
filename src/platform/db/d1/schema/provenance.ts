import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { assets } from "./assets";

// 这里定义出处边：让每条 L2 记忆（statement/entity/edge）都能直接溯回 L1 asset/chunk。
const provenanceMemoryTypeValues = ["statement", "entity", "edge"] as const;
const recordKindValues = ["library", "memory"] as const;

export const provenance = sqliteTable(
  "provenance",
  {
    id: text("id").primaryKey(),
    scopeId: text("scope_id").notNull().default("default"),
    contextKey: text("context_key").notNull().default("global"),
    recordKind: text("record_kind", { enum: recordKindValues })
      .notNull()
      .default("library"),
    // memory_type 区分 memory_id 指向哪类 L2 记忆（statement/entity/edge）。
    memoryType: text("memory_type", {
      enum: provenanceMemoryTypeValues,
    }).notNull(),
    memoryId: text("memory_id").notNull(),
    assetId: text("asset_id").references(() => assets.id, {
      onDelete: "cascade",
    }),
    chunkIndex: integer("chunk_index"),
    span: text("span"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("provenance_scope_id_idx").on(table.scopeId),
    index("provenance_context_key_idx").on(table.contextKey),
    index("provenance_record_kind_idx").on(table.recordKind),
    index("provenance_memory_idx").on(table.memoryType, table.memoryId),
    index("provenance_asset_id_idx").on(table.assetId),
  ]
);
