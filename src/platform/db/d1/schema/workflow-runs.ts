import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { assets } from "./assets";

const workflowTypeValues = [
  "note_ingest_v1",
  "pdf_ingest_v1",
  "url_ingest_v1",
  "image_ingest_v1",
  "chat_ingest_v1",
] as const;
const workflowTriggerTypeValues = [
  "ingest",
  "reprocess",
  "backfill",
  "manual",
] as const;
const workflowRunStatusValues = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;

// 这里记录资产级 workflow 运行实例，为后续接入 Queue 和重试提供统一状态骨架。
export const workflowRuns = sqliteTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, {
        onDelete: "cascade",
      }),
    workflowType: text("workflow_type", { enum: workflowTypeValues }).notNull(),
    triggerType: text("trigger_type", {
      enum: workflowTriggerTypeValues,
    }).notNull(),
    status: text("status", { enum: workflowRunStatusValues }).notNull(),
    currentStep: text("current_step"),
    errorMessage: text("error_message"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("workflow_runs_asset_id_idx").on(table.assetId),
    index("workflow_runs_status_idx").on(table.status),
    index("workflow_runs_type_idx").on(table.workflowType),
    index("workflow_runs_created_at_idx").on(table.createdAt),
  ]
);
