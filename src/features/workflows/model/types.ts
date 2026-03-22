// 这里集中定义 workflow 领域类型，供运行时、存储和后续队列执行统一复用。
export type WorkflowType =
  | "note_ingest_v1"
  | "pdf_ingest_v1"
  | "url_ingest_v1"
  | "image_ingest_v1"
  | "chat_ingest_v1";

export type WorkflowTriggerType =
  | "ingest"
  | "reprocess"
  | "backfill"
  | "manual";

export type WorkflowRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type WorkflowStepStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";

export type WorkflowStepType =
  | "load_source"
  | "clean_content"
  | "persist_content"
  | "summarize"
  | "classify"
  | "derive_descriptor"
  | "derive_access_policy"
  | "derive_facets"
  | "derive_assertions"
  | "chunk"
  | "embed"
  | "index"
  | "finalize"
  | "caption_image"
  | "extract_entities";

export type AssetArtifactType =
  | "clean_content"
  | "summary"
  | "classification"
  | "descriptor"
  | "access_policy"
  | "entities"
  | "image_caption"
  | "document_outline";

export type AssetArtifactStorageKind = "inline" | "r2";

export interface WorkflowRunRecord {
  id: string;
  assetId: string;
  workflowType: WorkflowType;
  triggerType: WorkflowTriggerType;
  status: WorkflowRunStatus;
  stateJson: string | null;
  currentStep: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStepRecord {
  id: string;
  runId: string;
  assetId: string;
  stepKey: string;
  stepType: WorkflowStepType;
  status: WorkflowStepStatus;
  attempt: number;
  inputJson: string | null;
  outputJson: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetArtifactRecord {
  id: string;
  assetId: string;
  artifactType: AssetArtifactType;
  version: number;
  storageKind: AssetArtifactStorageKind;
  r2Key: string | null;
  contentText: string | null;
  metadataJson: string | null;
  createdByRunId: string | null;
  createdAt: string;
}

export interface WorkflowRunDetail {
  run: WorkflowRunRecord;
  steps: WorkflowStepRecord[];
  artifacts: AssetArtifactRecord[];
}
