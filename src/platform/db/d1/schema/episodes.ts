import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { assets } from "./assets";

// 这里定义 L1 情节流（Zep 式非损 episodic）：把 ingest / chat_turn / agent_assert / correction
// 四种写入统一成同一条时间线，作为 L2 记忆抽取的不可变来源。
const episodeKindValues = [
  "ingest",
  "chat_turn",
  "agent_assert",
  "correction",
] as const;

export const episodes = sqliteTable(
  "episodes",
  {
    id: text("id").primaryKey(),
    // scope_id 贯穿三层；MVP 仅用默认值（ADR-004），多 scope 留接口不实现。
    scopeId: text("scope_id").notNull().default("default"),
    kind: text("kind", { enum: episodeKindValues }).notNull(),
    // doc 导入路径关联到 L1 asset；纯 chat/agent 情节可为空。
    assetId: text("asset_id").references(() => assets.id, {
      onDelete: "cascade",
    }),
    // 情节原文：短文走 raw_text，长文落 R2（二选一）。
    rawText: text("raw_text"),
    rawR2Key: text("raw_r2_key"),
    actor: text("actor"),
    // 事件时（情节在世界中发生）与录入时（系统记录）。
    occurredAt: text("occurred_at"),
    recordedAt: text("recorded_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("episodes_scope_id_idx").on(table.scopeId),
    index("episodes_kind_idx").on(table.kind),
    index("episodes_asset_id_idx").on(table.assetId),
    index("episodes_occurred_at_idx").on(table.occurredAt),
    index("episodes_scope_kind_occurred_idx").on(
      table.scopeId,
      table.kind,
      table.occurredAt
    ),
  ]
);
