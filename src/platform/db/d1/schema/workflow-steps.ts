import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { assets } from "./assets";
import { workflowRuns } from "./workflow-runs";

const workflowStepStatusValues = [
  "pending",
  "running",
  "succeeded",
  "failed",
  "skipped",
] as const;
const workflowStepTypeValues = [
  "load_source",
  "clean_content",
  "persist_content",
  "summarize",
  "classify",
  "derive_descriptor",
  "derive_access_policy",
  "derive_facets",
  "derive_assertions",
  "chunk",
  "embed",
  "index",
  "finalize",
  "caption_image",
  "extract_entities",
] as const;

// 这里记录 workflow 每一步的执行状态，并补充目录与策略派生步骤。
export const workflowSteps = sqliteTable(
  "workflow_steps",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => workflowRuns.id, {
        onDelete: "cascade",
      }),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, {
        onDelete: "cascade",
      }),
    stepKey: text("step_key").notNull(),
    stepType: text("step_type", { enum: workflowStepTypeValues }).notNull(),
    status: text("status", { enum: workflowStepStatusValues }).notNull(),
    attempt: integer("attempt").notNull().default(0),
    inputJson: text("input_json"),
    outputJson: text("output_json"),
    errorMessage: text("error_message"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("workflow_steps_run_id_idx").on(table.runId),
    index("workflow_steps_asset_id_idx").on(table.assetId),
    index("workflow_steps_status_idx").on(table.status),
    index("workflow_steps_type_idx").on(table.stepType),
  ]
);
