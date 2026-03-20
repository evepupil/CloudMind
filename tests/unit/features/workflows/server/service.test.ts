import { describe, expect, it, vi } from "vitest";

import type { WorkflowRepository } from "@/core/workflows/ports";
import { createWorkflowService } from "@/features/workflows/server/service";

describe("workflow service", () => {
  it("lists workflow runs by asset id", async () => {
    const repository: WorkflowRepository = {
      createWorkflowRun: vi.fn(),
      getWorkflowRunById: vi.fn(),
      listWorkflowRunsByAssetId: vi.fn().mockResolvedValue([
        {
          id: "run-1",
          assetId: "asset-1",
          workflowType: "note_ingest_v1",
          triggerType: "ingest",
          status: "succeeded",
          stateJson: "{}",
          currentStep: null,
          errorMessage: null,
          startedAt: null,
          finishedAt: null,
          createdAt: "2026-03-20T00:00:00.000Z",
          updatedAt: "2026-03-20T00:00:00.000Z",
        },
      ]),
      getWorkflowRunDetail: vi.fn(),
      createWorkflowSteps: vi.fn(),
      listWorkflowStepsByRunId: vi.fn(),
      updateWorkflowRunState: vi.fn(),
      markWorkflowRunRunning: vi.fn(),
      completeWorkflowRun: vi.fn(),
      failWorkflowRun: vi.fn(),
      markWorkflowStepRunning: vi.fn(),
      completeWorkflowStep: vi.fn(),
      skipWorkflowStep: vi.fn(),
      failWorkflowStep: vi.fn(),
      createAssetArtifact: vi.fn(),
      listAssetArtifactsByRunId: vi.fn(),
    };
    const service = createWorkflowService({
      getWorkflowRepository: vi.fn().mockResolvedValue(repository),
    });

    const result = await service.listWorkflowRunsByAssetId(
      { APP_NAME: "cloudmind-test" },
      "asset-1"
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: "run-1",
        assetId: "asset-1",
      }),
    ]);
    expect(repository.listWorkflowRunsByAssetId).toHaveBeenCalledWith(
      "asset-1"
    );
  });

  it("gets workflow run detail", async () => {
    const detail = {
      run: {
        id: "run-1",
        assetId: "asset-1",
        workflowType: "pdf_ingest_v1" as const,
        triggerType: "reprocess" as const,
        status: "failed" as const,
        stateJson: "{}",
        currentStep: "embed",
        errorMessage: "Embedding timeout",
        startedAt: null,
        finishedAt: null,
        createdAt: "2026-03-20T00:00:00.000Z",
        updatedAt: "2026-03-20T00:00:00.000Z",
      },
      steps: [],
      artifacts: [],
    };
    const repository: WorkflowRepository = {
      createWorkflowRun: vi.fn(),
      getWorkflowRunById: vi.fn(),
      listWorkflowRunsByAssetId: vi.fn(),
      getWorkflowRunDetail: vi.fn().mockResolvedValue(detail),
      createWorkflowSteps: vi.fn(),
      listWorkflowStepsByRunId: vi.fn(),
      updateWorkflowRunState: vi.fn(),
      markWorkflowRunRunning: vi.fn(),
      completeWorkflowRun: vi.fn(),
      failWorkflowRun: vi.fn(),
      markWorkflowStepRunning: vi.fn(),
      completeWorkflowStep: vi.fn(),
      skipWorkflowStep: vi.fn(),
      failWorkflowStep: vi.fn(),
      createAssetArtifact: vi.fn(),
      listAssetArtifactsByRunId: vi.fn(),
    };
    const service = createWorkflowService({
      getWorkflowRepository: vi.fn().mockResolvedValue(repository),
    });

    const result = await service.getWorkflowRunDetail(
      { APP_NAME: "cloudmind-test" },
      "run-1"
    );

    expect(result).toEqual(detail);
    expect(repository.getWorkflowRunDetail).toHaveBeenCalledWith("run-1");
  });
});
