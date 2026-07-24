import {
  createExecutionContext,
  createMessageBatch,
  getQueueResult,
} from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";

import type { JobQueueMessage } from "@/core/queue/ports";
import { consumeQueueBatch } from "@/features/workflows/server/queue-batch-consumer";
import { loadOrCreateTextSourceSnapshot } from "@/features/workflows/server/text-source-snapshot";
import { R2BlobStore } from "@/platform/blob/r2/r2-blob-store";
import { D1AssetRepository } from "@/platform/db/d1/repositories/d1-asset-repository";
import { D1MemoryRepository } from "@/platform/db/d1/repositories/d1-memory-repository";
import { D1WorkflowRepository } from "@/platform/db/d1/repositories/d1-workflow-repository";

const insertAsset = async (
  assetId: string,
  contentText: string | null = null
): Promise<void> => {
  const now = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO assets " +
      "(id, type, title, status, content_text, created_at, updated_at) " +
      "VALUES (?, 'note', 'Queue gate fixture', 'pending', ?, ?, ?)"
  )
    .bind(assetId, contentText, now, now)
    .run();
};

describe("Workers runtime quality gate", () => {
  it("isolates identical project concepts by scope and context", async () => {
    const assetRepository = new D1AssetRepository(env.DB);
    const memoryRepository = new D1MemoryRepository(env.DB);
    const contextA = "project:github:evepupil/ProjectA";
    const contextB = "project:github:evepupil/ProjectB";
    const [assetA, assetB] = await Promise.all([
      assetRepository.createTextAsset({
        content: "M1 belongs to project A",
        recordKind: "memory",
        scopeId: "agent",
        contextKey: contextA,
      }),
      assetRepository.createTextAsset({
        content: "M1 belongs to project B",
        recordKind: "memory",
        scopeId: "agent",
        contextKey: contextB,
      }),
    ]);
    const entityA = await memoryRepository.upsertEntityByNormalizedName({
      canonicalName: "M1",
      normalizedName: "m1",
      scopeId: "agent",
      contextKey: contextA,
    });
    const entityB = await memoryRepository.upsertEntityByNormalizedName({
      canonicalName: "M1",
      normalizedName: "m1",
      scopeId: "agent",
      contextKey: contextB,
    });
    await memoryRepository.createStatement({
      scopeId: "agent",
      contextKey: contextA,
      recordKind: "memory",
      subjectEntityId: entityA.id,
      predicate: "belongs to",
      objectLiteral: "Project A",
      nlText: "M1 belongs to project A",
    });

    const [assetsA, assetsB, statementsA, crossProjectStatements] =
      await Promise.all([
        assetRepository.listAssets({
          recordKind: "memory",
          scopeId: "agent",
          contextKey: contextA,
        }),
        assetRepository.listAssets({
          recordKind: "memory",
          scopeId: "agent",
          contextKey: contextB,
        }),
        memoryRepository.findActiveStatementsBySubject(
          entityA.id,
          "agent",
          contextA,
          "memory"
        ),
        memoryRepository.findActiveStatementsBySubject(
          entityA.id,
          "agent",
          contextB,
          "memory"
        ),
      ]);

    expect(entityA.id).not.toBe(entityB.id);
    expect(assetsA.items.map((asset) => asset.id)).toContain(assetA.id);
    expect(assetsA.items.map((asset) => asset.id)).not.toContain(assetB.id);
    expect(assetsB.items.map((asset) => asset.id)).toContain(assetB.id);
    expect(statementsA).toHaveLength(1);
    expect(crossProjectStatements).toEqual([]);
  });

  it("repairs drifted edges across projects without crossing boundaries", async () => {
    const repository = new D1MemoryRepository(env.DB);
    const contextA = "project:github:evepupil/RepairA";
    const contextB = "project:github:evepupil/RepairB";
    const [entityA, entityB] = await Promise.all([
      repository.upsertEntityByNormalizedName({
        canonicalName: "M1 Repair A",
        normalizedName: "m1-repair-a",
        scopeId: "agent",
        contextKey: contextA,
      }),
      repository.upsertEntityByNormalizedName({
        canonicalName: "M1 Repair B",
        normalizedName: "m1-repair-b",
        scopeId: "agent",
        contextKey: contextB,
      }),
    ]);
    const drifted = await repository.createEdge({
      scopeId: "agent",
      contextKey: contextA,
      recordKind: "memory",
      srcEntityId: entityA.id,
      dstEntityId: entityA.id,
      relation: "tracks",
    });
    const backed = await repository.createEdge({
      scopeId: "agent",
      contextKey: contextB,
      recordKind: "memory",
      srcEntityId: entityB.id,
      dstEntityId: entityB.id,
      relation: "tracks",
    });
    await repository.createStatement({
      scopeId: "agent",
      contextKey: contextB,
      recordKind: "memory",
      subjectEntityId: entityB.id,
      predicate: "tracks",
      objectEntityId: entityB.id,
      nlText: "M1 Repair B tracks itself",
    });

    expect(await repository.findDriftedEdges("agent")).toEqual([
      expect.objectContaining({ id: drifted.id, contextKey: contextA }),
    ]);
    expect(
      await repository.findActiveOutgoingEdges([entityA.id, entityB.id], {
        scopeIds: ["agent"],
        contextKeys: [contextA, contextB],
        recordKinds: ["memory"],
      })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: drifted.id, contextKey: contextA }),
        expect.objectContaining({ id: backed.id, contextKey: contextB }),
      ])
    );

    await repository.invalidateActiveEdges({
      scopeId: "agent",
      contextKey: contextA,
      recordKind: "memory",
      srcEntityId: entityA.id,
      dstEntityId: entityA.id,
      relation: "tracks",
    });

    expect(
      await repository.findActiveOutgoingEdges([entityB.id], {
        scopeIds: ["agent"],
        contextKeys: [contextB],
        recordKinds: ["memory"],
      })
    ).toEqual([expect.objectContaining({ id: backed.id })]);
  });

  it("preserves text snapshots across real D1 and R2 bindings", async () => {
    const assetId = crypto.randomUUID();
    const original = "  exact MCP text\r\nwith original spacing  ";
    await insertAsset(assetId, original);

    const repository = new D1AssetRepository(env.DB);
    const blobStore = new R2BlobStore(env.ASSET_FILES);
    const asset = await repository.getAssetById(assetId);
    const created = await loadOrCreateTextSourceSnapshot(
      asset,
      repository,
      blobStore
    );

    expect(created.source).toBe("created");
    expect(created.content).toBe(original);

    const storedAsset = await repository.getAssetById(assetId);
    expect(storedAsset.rawR2Key).toBe(created.rawR2Key);

    await env.DB.prepare("UPDATE assets SET content_text = ? WHERE id = ?")
      .bind("mutable preview", assetId)
      .run();

    const reused = await loadOrCreateTextSourceSnapshot(
      await repository.getAssetById(assetId),
      repository,
      blobStore
    );

    expect(reused.source).toBe("archive");
    expect(reused.content).toBe(original);
    await expect(
      repository.attachAssetRawSnapshot(assetId, created.rawR2Key)
    ).resolves.toBeUndefined();
    await expect(
      repository.attachAssetRawSnapshot(
        assetId,
        `assets/${assetId}/raw/replacement.txt`
      )
    ).rejects.toThrow("already references a different raw snapshot");
  });

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
