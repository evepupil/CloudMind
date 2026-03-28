import type { AIProvider } from "@/core/ai/ports";
import type { AssetIngestRepository } from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
import type { JobQueue, JobQueueMessage } from "@/core/queue/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { WebPageFetcher } from "@/core/web/ports";
import type {
  CreateAssetArtifactInput,
  WorkflowRepository,
} from "@/core/workflows/ports";
import type { AssetDetail } from "@/features/assets/model/types";
import type {
  WorkflowStepRecord,
  WorkflowStepType,
  WorkflowTriggerType,
  WorkflowType,
} from "@/features/workflows/model/types";
import { createLogger } from "@/platform/observability/logger";

export interface WorkflowServices {
  assetRepository: AssetIngestRepository;
  workflowRepository: WorkflowRepository;
  blobStore: BlobStore;
  vectorStore: VectorStore;
  aiProvider: AIProvider;
  jobQueue: JobQueue;
  webPageFetcher?: WebPageFetcher | undefined;
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

export interface WorkflowStepQueuePayload {
  runId: string;
  stepKey: string;
}

const stringifyJson = (
  value: Record<string, unknown> | undefined
): string | null => {
  if (!value || Object.keys(value).length === 0) {
    return null;
  }

  return JSON.stringify(value);
};

const parseStateJson = (value: string | null): Record<string, unknown> => {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {}

  return {};
};

const getLatestJob = (asset: AssetDetail) => {
  return asset.jobs[0] ?? null;
};

const workflowLogger = createLogger("workflow");

const createWorkflowStepMessage = (
  payload: WorkflowStepQueuePayload
): JobQueueMessage => {
  return {
    type: "workflow_step",
    payloadJson: JSON.stringify(payload),
    dedupeKey: `${payload.runId}:${payload.stepKey}`,
  };
};

const getStepDefinition = (
  definition: WorkflowDefinition,
  stepKey: string
): WorkflowStepDefinition => {
  const step = definition.steps.find((item) => item.key === stepKey);

  if (!step) {
    throw new Error(
      `Workflow "${definition.type}" is missing step "${stepKey}".`
    );
  }

  return step;
};

const getNextStepDefinition = (
  definition: WorkflowDefinition,
  stepKey: string
): WorkflowStepDefinition | null => {
  const currentIndex = definition.steps.findIndex(
    (item) => item.key === stepKey
  );

  if (currentIndex === -1) {
    throw new Error(
      `Workflow "${definition.type}" is missing step "${stepKey}".`
    );
  }

  return definition.steps[currentIndex + 1] ?? null;
};

const getWorkflowStepRecord = (
  steps: WorkflowStepRecord[],
  stepKey: string
): WorkflowStepRecord => {
  const step = steps.find((item) => item.stepKey === stepKey);

  if (!step) {
    throw new Error(`Workflow step "${stepKey}" was not created.`);
  }

  return step;
};

// 这里负责只创建 run/steps 并投递首个 step，真正执行放到 Queue consumer。
export const enqueueWorkflow = async (
  definition: WorkflowDefinition,
  assetId: string,
  triggerType: WorkflowTriggerType,
  services: WorkflowServices,
  options?: {
    force?: boolean;
  },
  initialState?: Record<string, unknown>
): Promise<AssetDetail> => {
  const asset = await services.assetRepository.getAssetById(assetId);
  const latestJob = getLatestJob(asset);

  if (
    !options?.force &&
    (asset.status === "ready" || asset.status === "failed")
  ) {
    return asset;
  }

  let runId: string | null = null;
  let firstStep: WorkflowStepRecord | null = null;

  try {
    await services.assetRepository.markAssetProcessing(asset.id);

    if (latestJob) {
      await services.assetRepository.markIngestJobRunning(latestJob.id);
    }

    const run = await services.workflowRepository.createWorkflowRun({
      assetId: asset.id,
      workflowType: definition.type,
      triggerType,
      stateJson: stringifyJson(initialState),
    });

    runId = run.id;
    workflowLogger.info("run_enqueued", {
      runId: run.id,
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

    firstStep = steps[0] ?? null;

    if (!firstStep) {
      await services.workflowRepository.completeWorkflowRun(run.id);

      if (latestJob) {
        await services.assetRepository.completeIngestJob(latestJob.id);
      }

      return services.assetRepository.getAssetById(asset.id);
    }

    await services.jobQueue.enqueue(
      createWorkflowStepMessage({
        runId: run.id,
        stepKey: firstStep.stepKey,
      })
    );
    workflowLogger.info("step_queued", {
      runId: run.id,
      assetId: asset.id,
      workflowType: definition.type,
      stepKey: firstStep.stepKey,
    });

    return services.assetRepository.getAssetById(asset.id);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown workflow enqueue error.";

    if (runId && firstStep) {
      await services.workflowRepository.failWorkflowStep(firstStep.id, message);
      await services.workflowRepository.failWorkflowRun(
        runId,
        firstStep.stepKey,
        message
      );
    } else if (runId) {
      await services.workflowRepository.failWorkflowRun(runId, null, message);
    }

    await services.assetRepository.failAssetProcessing(asset.id, message);

    if (latestJob) {
      await services.assetRepository.failIngestJob(latestJob.id, message);
    }

    return services.assetRepository.getAssetById(asset.id);
  }
};

// 这里消费单条 workflow step 消息，执行成功后继续投递下一步。
export const consumeWorkflowStepMessage = async (
  definition: WorkflowDefinition,
  payload: WorkflowStepQueuePayload,
  services: WorkflowServices
): Promise<void> => {
  const run = await services.workflowRepository.getWorkflowRunById(
    payload.runId
  );

  if (run.workflowType !== definition.type) {
    throw new Error(
      `Workflow type mismatch for run "${run.id}": expected "${definition.type}" but got "${run.workflowType}".`
    );
  }

  if (
    run.status === "succeeded" ||
    run.status === "failed" ||
    run.status === "cancelled"
  ) {
    return;
  }

  const asset = await services.assetRepository.getAssetById(run.assetId);
  const latestJob = getLatestJob(asset);
  const steps = await services.workflowRepository.listWorkflowStepsByRunId(
    run.id
  );
  const step = getWorkflowStepRecord(steps, payload.stepKey);

  if (step.status === "succeeded" || step.status === "skipped") {
    return;
  }

  const stepDefinition = getStepDefinition(definition, payload.stepKey);
  const state = parseStateJson(run.stateJson);
  const startedAt = Date.now();

  await services.workflowRepository.markWorkflowRunRunning(
    run.id,
    step.stepKey
  );
  await services.workflowRepository.markWorkflowStepRunning(step.id);
  workflowLogger.info("step_started", {
    runId: run.id,
    assetId: asset.id,
    workflowType: run.workflowType,
    stepKey: step.stepKey,
    attempt: step.attempt + 1,
  });

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

    await services.workflowRepository.updateWorkflowRunState(
      run.id,
      stringifyJson(state)
    );

    if (result.status === "skipped") {
      await services.workflowRepository.skipWorkflowStep(
        step.id,
        stringifyJson(result.output)
      );
      workflowLogger.info("step_skipped", {
        runId: run.id,
        assetId: asset.id,
        workflowType: run.workflowType,
        stepKey: step.stepKey,
        durationMs: Date.now() - startedAt,
      });
    } else {
      await services.workflowRepository.completeWorkflowStep(
        step.id,
        stringifyJson(result.output)
      );
      workflowLogger.info("step_succeeded", {
        runId: run.id,
        assetId: asset.id,
        workflowType: run.workflowType,
        stepKey: step.stepKey,
        durationMs: Date.now() - startedAt,
      });
    }

    const nextStep = getNextStepDefinition(definition, step.stepKey);

    if (!nextStep) {
      await services.workflowRepository.completeWorkflowRun(run.id);
      workflowLogger.info("run_succeeded", {
        runId: run.id,
        assetId: asset.id,
        workflowType: run.workflowType,
      });

      if (latestJob) {
        await services.assetRepository.completeIngestJob(latestJob.id);
      }

      return;
    }

    await services.jobQueue.enqueue(
      createWorkflowStepMessage({
        runId: run.id,
        stepKey: nextStep.key,
      })
    );
    workflowLogger.info("step_queued", {
      runId: run.id,
      assetId: asset.id,
      workflowType: run.workflowType,
      stepKey: nextStep.key,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown workflow step error.";

    await services.workflowRepository.failWorkflowStep(step.id, message);
    await services.workflowRepository.failWorkflowRun(
      run.id,
      step.stepKey,
      message
    );
    await services.assetRepository.failAssetProcessing(asset.id, message);

    if (latestJob) {
      await services.assetRepository.failIngestJob(latestJob.id, message);
    }

    workflowLogger.error(
      "step_failed",
      {
        runId: run.id,
        assetId: asset.id,
        workflowType: run.workflowType,
        stepKey: step.stepKey,
        durationMs: Date.now() - startedAt,
      },
      { error }
    );

    throw error;
  }
};

export const parseWorkflowStepQueuePayload = (
  message: JobQueueMessage
): WorkflowStepQueuePayload | null => {
  if (message.type !== "workflow_step") {
    return null;
  }

  try {
    const payload = JSON.parse(message.payloadJson);

    if (
      payload &&
      typeof payload === "object" &&
      typeof payload.runId === "string" &&
      typeof payload.stepKey === "string"
    ) {
      return {
        runId: payload.runId,
        stepKey: payload.stepKey,
      };
    }
  } catch {}

  return null;
};
