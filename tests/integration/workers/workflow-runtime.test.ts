import {
  createExecutionContext,
  createMessageBatch,
  getQueueResult,
} from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";

import type { JobQueueMessage } from "@/core/queue/ports";
import { consumeQueueBatch } from "@/features/workflows/server/queue-batch-consumer";
import { D1WorkflowRepository } from "@/platform/db/d1/repositories/d1-workflow-repository";

const insertAsset = async (assetId: string): Promise<void> => {
  const now = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO assets (id, type, title, status, created_at, updated_at) " +
      "VALUES (?, 'note', 'Queue gate fixture', 'pending', ?, ?)"
  )
    .bind(assetId, now, now)
    .run();
};

describe("Workers runtime quality gate", () => {
  it("atomically claims a workflow step only once", async () => {
    const assetId = crypto.randomUUID();
    await insertAsset(assetId);

    const repository = new D1WorkflowRepository(env.DB);
    const run = await repository.createWorkflowRun({
      assetId,
      workflowType: "note_ingest_v1",
      triggerType: "ingest",
    });
    const [step] = await repository.createWorkflowSteps(run.id, [
      {
        assetId,
        stepKey: "clean_content",
        stepType: "clean_content",
      },
    ]);

    expect(step).toBeDefined();
    const stepId = step?.id ?? "";

    const claims = await Promise.all([
      repository.markWorkflowStepRunning(stepId),
      repository.markWorkflowStepRunning(stepId),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    const [storedStep] = await repository.listWorkflowStepsByRunId(run.id);
    expect(storedStep?.status).toBe("running");
    expect(storedStep?.attempt).toBe(1);
  });

  it("acks successful messages and retries failed messages", async () => {
    const success: JobQueueMessage = {
      type: "workflow_step",
      payloadJson: '{"runId":"run-1","stepKey":"clean_content"}',
    };
    const failure: JobQueueMessage = {
      type: "workflow_step",
      payloadJson: '{"runId":"run-2","stepKey":"clean_content"}',
    };
    const batch = createMessageBatch<JobQueueMessage>("cloudmind-workflows", [
      {
        id: "message-success",
        timestamp: new Date(),
        attempts: 1,
        body: success,
      },
      {
        id: "message-failure",
        timestamp: new Date(),
        attempts: 1,
        body: failure,
      },
    ]);
    const context = createExecutionContext();
    const consumer = vi.fn(async (message: JobQueueMessage) => {
      if (message.payloadJson.includes('"runId":"run-2"')) {
        throw new Error("retry this message");
      }
    });

    await consumeQueueBatch(batch, consumer);
    const result = await getQueueResult(batch, context);

    expect(consumer).toHaveBeenCalledTimes(2);
    expect(result.explicitAcks).toEqual(["message-success"]);
    expect(result.retryMessages).toEqual([
      expect.objectContaining({ msgId: "message-failure" }),
    ]);
  });
});
