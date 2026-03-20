import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { assets } from "./assets";
import { workflowRuns } from "./workflow-runs";

const assetArtifactTypeValues = [
  "clean_content",
  "summary",
  "classification",
  "entities",
  "image_caption",
  "document_outline",
] as const;
const assetArtifactStorageKindValues = ["inline", "r2"] as const;

// 这里沉淀资产派生结果，避免把摘要、分类、图像描述等全部堆进 assets 主表。
export const assetArtifacts = sqliteTable(
  "asset_artifacts",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, {
        onDelete: "cascade",
      }),
    artifactType: text("artifact_type", {
      enum: assetArtifactTypeValues,
    }).notNull(),
    version: integer("version").notNull().default(1),
    storageKind: text("storage_kind", {
      enum: assetArtifactStorageKindValues,
    }).notNull(),
    r2Key: text("r2_key"),
    contentText: text("content_text"),
    metadataJson: text("metadata_json"),
    createdByRunId: text("created_by_run_id").references(
      () => workflowRuns.id,
      {
        onDelete: "set null",
      }
    ),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("asset_artifacts_asset_id_idx").on(table.assetId),
    index("asset_artifacts_type_idx").on(table.artifactType),
    index("asset_artifacts_run_id_idx").on(table.createdByRunId),
  ]
);
