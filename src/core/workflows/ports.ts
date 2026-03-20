import type {
  AssetArtifactStorageKind,
  AssetArtifactType,
  WorkflowRunRecord,
  WorkflowStepRecord,
  WorkflowStepType,
  WorkflowTriggerType,
  WorkflowType,
} from "@/features/workflows/model/types";

export interface CreateWorkflowRunInput {
  assetId: string;
  workflowType: WorkflowType;
  triggerType: WorkflowTriggerType;
  stateJson?: string | null | undefined;
}

export interface CreateWorkflowStepInput {
  assetId: string;
  stepKey: string;
  stepType: WorkflowStepType;
  inputJson?: string | null | undefined;
}

export interface CreateAssetArtifactInput {
  assetId: string;
  artifactType: AssetArtifactType;
  storageKind: AssetArtifactStorageKind;
  r2Key?: string | null | undefined;
  contentText?: string | null | undefined;
  metadataJson?: string | null | undefined;
  createdByRunId?: string | null | undefined;
}

// 这里抽象 workflow 持久化边界，避免运行时直接散落 D1 细节。
export interface WorkflowRepository {
  createWorkflowRun(input: CreateWorkflowRunInput): Promise<{
    id: string;
  }>;
  getWorkflowRunById(runId: string): Promise<WorkflowRunRecord>;
  createWorkflowSteps(
    runId: string,
    steps: CreateWorkflowStepInput[]
  ): Promise<WorkflowStepRecord[]>;
  listWorkflowStepsByRunId(runId: string): Promise<WorkflowStepRecord[]>;
  updateWorkflowRunState(
    runId: string,
    stateJson?: string | null
  ): Promise<void>;
  markWorkflowRunRunning(runId: string, currentStep: string): Promise<void>;
  completeWorkflowRun(runId: string): Promise<void>;
  failWorkflowRun(
    runId: string,
    currentStep: string | null,
    message: string
  ): Promise<void>;
  markWorkflowStepRunning(stepId: string): Promise<void>;
  completeWorkflowStep(
    stepId: string,
    outputJson?: string | null
  ): Promise<void>;
  skipWorkflowStep(stepId: string, outputJson?: string | null): Promise<void>;
  failWorkflowStep(
    stepId: string,
    message: string,
    outputJson?: string | null
  ): Promise<void>;
  createAssetArtifact(input: CreateAssetArtifactInput): Promise<void>;
}
