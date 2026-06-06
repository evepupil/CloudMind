import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// 这里定义 L2 知识图谱的实体节点。每个实体恒带一个 Vectorize graph_entities namespace
// 的向量 id（图↔向量恒绑定，对标 Cognee），供实体消歧与语义召回复用。
export const entities = sqliteTable(
  "entities",
  {
    id: text("id").primaryKey(),
    scopeId: text("scope_id").notNull().default("default"),
    canonicalName: text("canonical_name").notNull(),
    // 归一化名（小写/去标点/折叠空白）用于消歧匹配。
    normalizedName: text("normalized_name").notNull(),
    // 开放词汇实体类型（person/org/concept/place/event/… 由抽取决定，不约束 enum）。
    type: text("type"),
    embeddingVectorId: text("embedding_vector_id"),
    // 显著性与被提及次数：sleep-time 衰减/强化的承载字段。
    salience: real("salience").notNull().default(0),
    mentionCount: integer("mention_count").notNull().default(0),
    aliasesJson: text("aliases_json"),
    firstSeenAt: text("first_seen_at"),
    lastSeenAt: text("last_seen_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("entities_scope_id_idx").on(table.scopeId),
    index("entities_normalized_name_idx").on(table.normalizedName),
    index("entities_type_idx").on(table.type),
    index("entities_embedding_vector_id_idx").on(table.embeddingVectorId),
    index("entities_scope_normalized_idx").on(
      table.scopeId,
      table.normalizedName
    ),
    index("entities_salience_idx").on(table.salience),
  ]
);
