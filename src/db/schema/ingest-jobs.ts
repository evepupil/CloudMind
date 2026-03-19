import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { assets } from "./assets";

const ingestJobTypeValues = [
  "fetch_source",
  "extract_content",
  "clean_content",
  "summarize",
  "classify",
  "chunk",
  "embed",
  "index",
  "finalize",
] as const;

const ingestJobStatusValues = [
  "queued",
  "running",
  "succeeded",
  "failed",
] as const;

// 这里记录异步处理任务状态，为后续接 Queues 和失败重试预留基础。
export const ingestJobs = sqliteTable(
  "ingest_jobs",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, {
        onDelete: "cascade",
      }),
    jobType: text("job_type", { enum: ingestJobTypeValues }).notNull(),
    status: text("status", { enum: ingestJobStatusValues }).notNull(),
    attempt: integer("attempt").notNull().default(0),
    errorMessage: text("error_message"),
    payloadJson: text("payload_json"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("ingest_jobs_asset_id_idx").on(table.assetId),
    index("ingest_jobs_status_idx").on(table.status),
    index("ingest_jobs_type_idx").on(table.jobType),
    index("ingest_jobs_created_at_idx").on(table.createdAt),
  ]
);
