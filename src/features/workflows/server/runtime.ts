import type { AIProvider } from "@/core/ai/ports";
import type { AssetIngestRepository } from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
import type { VectorStore } from "@/core/vector/ports";
import type {
  CreateAssetArtifactInput,
  WorkflowRepository,
} from "@/core/workflows/ports";
import type { AssetDetail } from "@/features/assets/model/types";
import type {
  WorkflowStepType,
  WorkflowTriggerType,
  WorkflowType,
} from "@/features/workflows/model/types";

export interface WorkflowServices {
  assetRepository: AssetIngestRepository;
  workflowRepository: WorkflowRepository;
  blobStore: BlobStore;
  vectorStore: VectorStore;
  aiProvider: AIProvider;
}

export interface WorkflowExecutionContext {
  asset: AssetDetail;
  runId: string;
  state: Record<string, unknown>;
  services: WorkflowServices;
}

export interface WorkflowStepResult {
  status?: "succeeded" | "skipped";
  output?: Record<string, unknown> | undefined;
  state?: Record<string, unknown> | undefined;
  artifacts?:
    | Array<Omit<CreateAssetArtifactInput, "assetId" | "createdByRunId">>
    | undefined;
}

export interface WorkflowStepDefinition {
  key: string;
  type: WorkflowStepType;
  execute: (
    context: WorkflowExecutionContext
  ) => Promise<WorkflowStepResult> | WorkflowStepResult;
}

export interface WorkflowDefinition {
  type: WorkflowType;
  steps: WorkflowStepDefinition[];
}

const stringifyJson = (
  value: Record<string, unknown> | undefined
): string | null => {
  if (!value) {
    return null;
  }

  return JSON.stringify(value);
};

// 这里实现最小 workflow runtime，先支持串行步骤执行，后续再接 Queue 做一步一消费。
export const runWorkflow = async (
  definition: WorkflowDefinition,
  asset: AssetDetail,
  triggerType: WorkflowTriggerType,
  services: WorkflowServices,
  initialState?: Record<string, unknown>
): Promise<{
  runId: string;
  state: Record<string, unknown>;
}> => {
  const run = await services.workflowRepository.createWorkflowRun({
    assetId: asset.id,
    workflowType: definition.type,
    triggerType,
  });
  const steps = await services.workflowRepository.createWorkflowSteps(
    run.id,
    definition.steps.map((step) => ({
      assetId: asset.id,
      stepKey: step.key,
      stepType: step.type,
    }))
  );
  const stepMap = new Map(steps.map((step) => [step.stepKey, step]));
  const state: Record<string, unknown> = {
    ...(initialState ?? {}),
  };

  for (const stepDefinition of definition.steps) {
    const step = stepMap.get(stepDefinition.key);

    if (!step) {
      throw new Error(`Workflow step "${stepDefinition.key}" was not created.`);
    }

    await services.workflowRepository.markWorkflowRunRunning(
      run.id,
      stepDefinition.key
    );
    await services.workflowRepository.markWorkflowStepRunning(step.id);

    try {
      const result = await stepDefinition.execute({
        asset,
        runId: run.id,
        state,
        services,
      });
      const nextState = result.state ?? {};

      Object.assign(state, nextState);

      for (const artifact of result.artifacts ?? []) {
        await services.workflowRepository.createAssetArtifact({
          assetId: asset.id,
          createdByRunId: run.id,
          ...artifact,
        });
      }

      if (result.status === "skipped") {
        await services.workflowRepository.skipWorkflowStep(
          step.id,
          stringifyJson(result.output)
        );
      } else {
        await services.workflowRepository.completeWorkflowStep(
          step.id,
          stringifyJson(result.output)
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown workflow step error.";

      await services.workflowRepository.failWorkflowStep(step.id, message);
      await services.workflowRepository.failWorkflowRun(
        run.id,
        stepDefinition.key,
        message
      );
      throw error;
    }
  }

  await services.workflowRepository.completeWorkflowRun(run.id);

  return {
    runId: run.id,
    state,
  };
};
