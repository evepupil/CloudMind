import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const deletionAuditTargetKindValues = ["memory"] as const;
const deletionAuditStatusValues = ["pending", "failed", "completed"] as const;

// 硬删除审计只保留不可逆目标哈希、清理数量和状态，不保留正文或对象 key。
export const deletionAudits = sqliteTable(
  "deletion_audits",
  {
    id: text("id").primaryKey(),
    targetHash: text("target_hash").notNull(),
    targetKind: text("target_kind", {
      enum: deletionAuditTargetKindValues,
    }).notNull(),
    status: text("status", { enum: deletionAuditStatusValues }).notNull(),
    assetCount: integer("asset_count").notNull(),
    blobCount: integer("blob_count").notNull(),
    assetVectorCount: integer("asset_vector_count").notNull(),
    graphVectorCount: integer("graph_vector_count").notNull(),
    l2RecordCount: integer("l2_record_count").notNull(),
    errorCode: text("error_code"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("deletion_audits_status_idx").on(table.status),
    index("deletion_audits_target_hash_idx").on(table.targetHash),
    index("deletion_audits_created_at_idx").on(table.createdAt),
  ]
);
