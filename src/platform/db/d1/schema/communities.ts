import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

const recordKindValues = ["library", "memory"] as const;

// 这里定义社区/整合摘要：把一组相关实体聚成社区并存其摘要 + 摘要向量，
// 对标 Zep 社区 / mem0 摘要，供宏观召回与 sleep-time 整合刷新。
export const communities = sqliteTable(
  "communities",
  {
    id: text("id").primaryKey(),
    scopeId: text("scope_id").notNull().default("default"),
    contextKey: text("context_key").notNull().default("global"),
    recordKind: text("record_kind", { enum: recordKindValues })
      .notNull()
      .default("library"),
    memberEntityIdsJson: text("member_entity_ids_json").notNull(),
    summary: text("summary"),
    summaryVectorId: text("summary_vector_id"),
    refreshedAt: text("refreshed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("communities_scope_id_idx").on(table.scopeId),
    index("communities_record_scope_context_idx").on(
      table.recordKind,
      table.scopeId,
      table.contextKey
    ),
    index("communities_summary_vector_id_idx").on(table.summaryVectorId),
  ]
);
