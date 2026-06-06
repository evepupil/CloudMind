import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { assets } from "./assets";
import { episodes } from "./episodes";

// 这里定义出处边：让每条 L2 记忆（statement/entity/edge）都能溯回 L1 证据
// （episode + asset + chunk + span），对标 Zep 的 episodic 边——记忆能答、事实能证。
const provenanceMemoryTypeValues = ["statement", "entity", "edge"] as const;

export const provenance = sqliteTable(
  "provenance",
  {
    id: text("id").primaryKey(),
    scopeId: text("scope_id").notNull().default("default"),
    // memory_type 区分 memory_id 指向哪类 L2 记忆（statement/entity/edge）。
    memoryType: text("memory_type", {
      enum: provenanceMemoryTypeValues,
    }).notNull(),
    memoryId: text("memory_id").notNull(),
    episodeId: text("episode_id").references(() => episodes.id, {
      onDelete: "cascade",
    }),
    assetId: text("asset_id").references(() => assets.id, {
      onDelete: "cascade",
    }),
    chunkIndex: integer("chunk_index"),
    span: text("span"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("provenance_scope_id_idx").on(table.scopeId),
    index("provenance_memory_idx").on(table.memoryType, table.memoryId),
    index("provenance_episode_id_idx").on(table.episodeId),
    index("provenance_asset_id_idx").on(table.assetId),
  ]
);
