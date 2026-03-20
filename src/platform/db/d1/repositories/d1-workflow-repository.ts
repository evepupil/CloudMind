import { and, asc, count, desc, eq, sql } from "drizzle-orm";

import { WorkflowRunNotFoundError } from "@/core/workflows/errors";
import type {
  CreateAssetArtifactInput,
  CreateWorkflowRunInput,
  CreateWorkflowStepInput,
  WorkflowRepository,
} from "@/core/workflows/ports";
import type {
  AssetArtifactRecord,
  WorkflowRunDetail,
  WorkflowRunRecord,
  WorkflowStepRecord,
} from "@/features/workflows/model/types";
import { createDb } from "@/platform/db/d1/client";
import {
  assetArtifacts,
  workflowRuns,
  workflowSteps,
} from "@/platform/db/d1/schema";

const mapWorkflowStepRecord = (
  record: typeof workflowSteps.$inferSelect
): WorkflowStepRecord => {
  return {
    id: record.id,
    runId: record.runId,
    assetId: record.assetId,
    stepKey: record.stepKey,
    stepType: record.stepType,
    status: record.status,
    attempt: record.attempt,
    inputJson: record.inputJson,
    outputJson: record.outputJson,
    errorMessage: record.errorMessage,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

const mapWorkflowRunRecord = (
  record: typeof workflowRuns.$inferSelect
): WorkflowRunRecord => {
  return {
    id: record.id,
    assetId: record.assetId,
    workflowType: record.workflowType,
    triggerType: record.triggerType,
    status: record.status,
    stateJson: record.stateJson,
    currentStep: record.currentStep,
    errorMessage: record.errorMessage,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

const mapAssetArtifactRecord = (
  record: typeof assetArtifacts.$inferSelect
): AssetArtifactRecord => {
  return {
    id: record.id,
    assetId: record.assetId,
    artifactType: record.artifactType,
    version: record.version,
    storageKind: record.storageKind,
    r2Key: record.r2Key,
    contentText: record.contentText,
    metadataJson: record.metadataJson,
    createdByRunId: record.createdByRunId,
    createdAt: record.createdAt,
  };
};

// 这里实现 workflow 持久化，供最小运行时记录 run/step/artifact 生命周期。
export class D1WorkflowRepository implements WorkflowRepository {
  private readonly db: ReturnType<typeof createDb>;

  public constructor(database: D1Database) {
    this.db = createDb(database);
  }

  public async createWorkflowRun(
    input: CreateWorkflowRunInput
  ): Promise<{ id: string }> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await this.db.insert(workflowRuns).values({
      id,
      assetId: input.assetId,
      workflowType: input.workflowType,
      triggerType: input.triggerType,
      status: "queued",
      stateJson: input.stateJson ?? null,
      currentStep: null,
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return { id };
  }

  public async getWorkflowRunById(runId: string): Promise<WorkflowRunRecord> {
    const [record] = await this.db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.id, runId))
      .limit(1);

    if (!record) {
      throw new WorkflowRunNotFoundError(runId);
    }

    return mapWorkflowRunRecord(record);
  }

  public async listWorkflowRunsByAssetId(
    assetId: string
  ): Promise<WorkflowRunRecord[]> {
    const records = await this.db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.assetId, assetId))
      .orderBy(desc(workflowRuns.createdAt));

    return records.map(mapWorkflowRunRecord);
  }

  public async getWorkflowRunDetail(runId: string): Promise<WorkflowRunDetail> {
    const [run, steps, artifacts] = await Promise.all([
      this.getWorkflowRunById(runId),
      this.listWorkflowStepsByRunId(runId),
      this.listAssetArtifactsByRunId(runId),
    ]);

    return {
      run,
      steps,
      artifacts,
    };
  }

  public async createWorkflowSteps(
    runId: string,
    steps: CreateWorkflowStepInput[]
  ): Promise<WorkflowStepRecord[]> {
    const now = new Date().toISOString();
    const rows = steps.map((step) => ({
      id: crypto.randomUUID(),
      runId,
      assetId: step.assetId,
      stepKey: step.stepKey,
      stepType: step.stepType,
      status: "pending" as const,
      attempt: 0,
      inputJson: step.inputJson ?? null,
      outputJson: null,
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    }));

    if (rows.length > 0) {
      await this.db.insert(workflowSteps).values(rows);
    }

    return rows.map(mapWorkflowStepRecord);
  }

  public async listWorkflowStepsByRunId(
    runId: string
  ): Promise<WorkflowStepRecord[]> {
    const records = await this.db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.runId, runId))
      .orderBy(asc(workflowSteps.createdAt), asc(workflowSteps.stepKey));

    return records.map(mapWorkflowStepRecord);
  }

  public async updateWorkflowRunState(
    runId: string,
    stateJson?: string | null
  ): Promise<void> {
    await this.db
      .update(workflowRuns)
      .set({
        stateJson: stateJson ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(workflowRuns.id, runId));
  }

  public async markWorkflowRunRunning(
    runId: string,
    currentStep: string
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(workflowRuns)
      .set({
        status: "running",
        currentStep,
        errorMessage: null,
        startedAt: now,
        updatedAt: now,
      })
      .where(eq(workflowRuns.id, runId));
  }

  public async completeWorkflowRun(runId: string): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(workflowRuns)
      .set({
        status: "succeeded",
        currentStep: null,
        errorMessage: null,
        finishedAt: now,
        updatedAt: now,
      })
      .where(eq(workflowRuns.id, runId));
  }

  public async failWorkflowRun(
    runId: string,
    currentStep: string | null,
    message: string
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(workflowRuns)
      .set({
        status: "failed",
        currentStep,
        errorMessage: message,
        finishedAt: now,
        updatedAt: now,
      })
      .where(eq(workflowRuns.id, runId));
  }

  public async markWorkflowStepRunning(stepId: string): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(workflowSteps)
      .set({
        status: "running",
        attempt: sql`${workflowSteps.attempt} + 1`,
        errorMessage: null,
        startedAt: now,
        updatedAt: now,
      })
      .where(eq(workflowSteps.id, stepId));
  }

  public async completeWorkflowStep(
    stepId: string,
    outputJson?: string | null
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(workflowSteps)
      .set({
        status: "succeeded",
        outputJson: outputJson ?? null,
        errorMessage: null,
        finishedAt: now,
        updatedAt: now,
      })
      .where(eq(workflowSteps.id, stepId));
  }

  public async skipWorkflowStep(
    stepId: string,
    outputJson?: string | null
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(workflowSteps)
      .set({
        status: "skipped",
        outputJson: outputJson ?? null,
        errorMessage: null,
        finishedAt: now,
        updatedAt: now,
      })
      .where(eq(workflowSteps.id, stepId));
  }

  public async failWorkflowStep(
    stepId: string,
    message: string,
    outputJson?: string | null
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(workflowSteps)
      .set({
        status: "failed",
        outputJson: outputJson ?? null,
        errorMessage: message,
        finishedAt: now,
        updatedAt: now,
      })
      .where(eq(workflowSteps.id, stepId));
  }

  public async createAssetArtifact(
    input: CreateAssetArtifactInput
  ): Promise<void> {
    const now = new Date().toISOString();
    const [latestVersion] = await this.db
      .select({ value: count() })
      .from(assetArtifacts)
      .where(
        and(
          eq(assetArtifacts.assetId, input.assetId),
          eq(assetArtifacts.artifactType, input.artifactType)
        )
      );

    await this.db.insert(assetArtifacts).values({
      id: crypto.randomUUID(),
      assetId: input.assetId,
      artifactType: input.artifactType,
      version: (latestVersion?.value ?? 0) + 1,
      storageKind: input.storageKind,
      r2Key: input.r2Key ?? null,
      contentText: input.contentText ?? null,
      metadataJson: input.metadataJson ?? null,
      createdByRunId: input.createdByRunId ?? null,
      createdAt: now,
    });
  }

  public async listAssetArtifactsByRunId(
    runId: string
  ): Promise<AssetArtifactRecord[]> {
    const records = await this.db
      .select()
      .from(assetArtifacts)
      .where(eq(assetArtifacts.createdByRunId, runId))
      .orderBy(asc(assetArtifacts.createdAt));

    return records.map(mapAssetArtifactRecord);
  }
}
