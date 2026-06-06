import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { entities } from "./entities";

// 这里定义 L2 的事实/陈述（subject-predicate-object），带 Graphiti 式双时间四字段：
//   valid_from / valid_until  事件时——该事实在世界中为真的区间（until 空=仍为真）
//   created_at / expired_at   录入时——系统相信该事实的区间（expired 空=系统仍相信）
// 矛盾不删：置 expired_at 失效并用 superseded_by_id 指向新事实。
export const statements = sqliteTable(
  "statements",
  {
    id: text("id").primaryKey(),
    scopeId: text("scope_id").notNull().default("default"),
    subjectEntityId: text("subject_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    predicate: text("predicate").notNull(),
    // 宾语二选一：指向实体（构成图边）或字面值（属性事实）。
    objectEntityId: text("object_entity_id").references(() => entities.id, {
      onDelete: "cascade",
    }),
    objectLiteral: text("object_literal"),
    nlText: text("nl_text").notNull(),
    embeddingVectorId: text("embedding_vector_id"),
    confidence: real("confidence"),
    importance: real("importance").notNull().default(0),
    validFrom: text("valid_from"),
    validUntil: text("valid_until"),
    createdAt: text("created_at").notNull(),
    expiredAt: text("expired_at"),
    // 软指针（不设 FK，避免自引用循环）：被哪条新事实取代。
    supersededById: text("superseded_by_id"),
    lastAccessedAt: text("last_accessed_at"),
    accessCount: integer("access_count").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("statements_scope_id_idx").on(table.scopeId),
    index("statements_subject_entity_id_idx").on(table.subjectEntityId),
    index("statements_object_entity_id_idx").on(table.objectEntityId),
    index("statements_predicate_idx").on(table.predicate),
    index("statements_embedding_vector_id_idx").on(table.embeddingVectorId),
    index("statements_expired_at_idx").on(table.expiredAt),
    // 当前有效事实按主语检索的承重索引（expired_at 空=有效）。
    index("statements_scope_subject_expired_idx").on(
      table.scopeId,
      table.subjectEntityId,
      table.expiredAt
    ),
  ]
);
