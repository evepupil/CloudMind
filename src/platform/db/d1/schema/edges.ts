import { index, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { entities } from "./entities";

// 这里定义 L2 知识图谱的有向关系边，同样带 bi-temporal 失效区间。
// 这是 D1 递归 CTE 多跳遍历（1-2 跳，控延迟）的遍历基底。
export const edges = sqliteTable(
  "edges",
  {
    id: text("id").primaryKey(),
    scopeId: text("scope_id").notNull().default("default"),
    srcEntityId: text("src_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    dstEntityId: text("dst_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    relation: text("relation").notNull(),
    weight: real("weight").notNull().default(1),
    confidence: real("confidence"),
    validFrom: text("valid_from"),
    validUntil: text("valid_until"),
    createdAt: text("created_at").notNull(),
    expiredAt: text("expired_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("edges_scope_id_idx").on(table.scopeId),
    index("edges_src_entity_id_idx").on(table.srcEntityId),
    index("edges_dst_entity_id_idx").on(table.dstEntityId),
    index("edges_relation_idx").on(table.relation),
    index("edges_expired_at_idx").on(table.expiredAt),
    // 递归 CTE 遍历承重索引：从 src 出发、按 scope 找未失效的出边。
    index("edges_scope_src_expired_idx").on(
      table.scopeId,
      table.srcEntityId,
      table.expiredAt
    ),
  ]
);
