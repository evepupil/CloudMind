import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AssetRepository } from "@/core/assets/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { AssetDetail } from "@/features/assets/model/types";
import { createMemoryLifecycleService } from "@/features/memory/server/lifecycle-service";

const contextKey = "project:github:evepupil/CloudMind";

const createMemory = (overrides: Partial<AssetDetail> = {}): AssetDetail => ({
  id: "memory-v1",
  type: "note",
  title: "CloudMind progress",
  summary: "M3-A1 complete",
  sourceUrl: null,
  sourceKind: "mcp",
  status: "ready",
  domain: "engineering",
  aiVisibility: "allow",
  retrievalPriority: 0,
  recordKind: "memory",
  scopeId: "agent",
  contextKey,
  memoryRootId: "memory-v1",
  memoryVersion: 1,
  previousVersionId: null,
  supersededById: null,
  supersededAt: null,
  deletedAt: null,
  collectionKey: null,
  capturedAt: "2026-07-24T00:00:00.000Z",
  createdAt: "2026-07-24T00:00:00.000Z",
  updatedAt: "2026-07-24T00:00:00.000Z",
  contentText: "M3-A1 complete",
  rawR2Key: "assets/memory-v1/raw/input.txt",
  contentR2Key: null,
  mimeType: "text/plain",
  language: "zh",
  errorMessage: null,
  processedAt: "2026-07-24T00:00:00.000Z",
  failedAt: null,
  source: null,
  jobs: [],
  chunks: [
    {
      id: "chunk-v1",
      chunkIndex: 0,
      textPreview: "M3-A1 complete",
      contentText: "M3-A1 complete",
      vectorId: "vector-v1",
    },
  ],
  ...overrides,
});

describe("memory lifecycle service", () => {
  const getAssetById = vi.fn<AssetRepository["getAssetById"]>();
  const softDeleteAsset = vi.fn<AssetRepository["softDeleteAsset"]>();
  const restoreAsset = vi.fn<AssetRepository["restoreAsset"]>();
  const repository = {
    getAssetById,
    softDeleteAsset,
    restoreAsset,
  } as unknown as AssetRepository;
  const vectorStore: VectorStore = {
    upsert: vi.fn(),
    search: vi.fn(),
    deleteByIds: vi.fn(),
  };
  const ingestTextAsset = vi.fn();
  const reprocessAsset = vi.fn();
  const service = createMemoryLifecycleService({
    getAssetRepository: vi.fn(async () => repository),
    getVectorStore: vi.fn(async () => vectorStore),
    ingestTextAsset,
    reprocessAsset,
  });
  const target = {
    id: "memory-v1",
    scopeId: "agent" as const,
    contextKey,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a pending immutable successor while the current version stays active", async () => {
    const previous = createMemory();
    const current = createMemory({
      id: "memory-v2",
      status: "processing",
      memoryVersion: 2,
      previousVersionId: "memory-v1",
      contentText: "M3-A2 in progress",
    });
    getAssetById.mockResolvedValue(previous);
    ingestTextAsset.mockResolvedValue(current);

    const result = await service.updateMemory(undefined, {
      ...target,
      content: "M3-A2 in progress",
    });

    expect(result).toEqual({ previous, current });
    expect(ingestTextAsset).toHaveBeenCalledWith(undefined, {
      content: "M3-A2 in progress",
      title: "CloudMind progress",
      sourceKind: "mcp",
      recordKind: "memory",
      scopeId: "agent",
      contextKey,
      aiVisibility: "allow",
      memoryRootId: "memory-v1",
      memoryVersion: 2,
      previousVersionId: "memory-v1",
    });
    expect(softDeleteAsset).not.toHaveBeenCalled();
  });

  it("rejects a cross-project update before creating a successor", async () => {
    getAssetById.mockResolvedValue(createMemory());

    await expect(
      service.updateMemory(undefined, {
        ...target,
        contextKey: "project:github:evepupil/Other",
        content: "Wrong project",
      })
    ).rejects.toMatchObject({
      code: "CONTEXT_MISMATCH",
    });
    expect(ingestTextAsset).not.toHaveBeenCalled();
  });

  it("soft deletes a memory and removes its chunk vectors", async () => {
    const active = createMemory();
    const deleted = createMemory({
      deletedAt: "2026-07-24T01:00:00.000Z",
    });
    getAssetById.mockResolvedValueOnce(active).mockResolvedValueOnce(deleted);

    const result = await service.forgetMemory(undefined, target);

    expect(softDeleteAsset).toHaveBeenCalledWith("memory-v1");
    expect(vectorStore.deleteByIds).toHaveBeenCalledWith(["vector-v1"]);
    expect(getAssetById).toHaveBeenLastCalledWith("memory-v1", {
      includeDeleted: true,
    });
    expect(result).toEqual({ item: deleted, vectorCleanupPending: false });
  });

  it("restores a deleted memory and queues immutable-snapshot reprocessing", async () => {
    const deleted = createMemory({
      deletedAt: "2026-07-24T01:00:00.000Z",
    });
    const processing = createMemory({ status: "processing", deletedAt: null });
    getAssetById.mockResolvedValue(deleted);
    restoreAsset.mockResolvedValue(processing);
    reprocessAsset.mockResolvedValue(processing);

    const result = await service.restoreMemory(undefined, target);

    expect(restoreAsset).toHaveBeenCalledWith("memory-v1");
    expect(reprocessAsset).toHaveBeenCalledWith(undefined, "memory-v1");
    expect(result).toEqual(processing);
  });

  it("rolls a failed restore back to soft-deleted state", async () => {
    const deleted = createMemory({
      deletedAt: "2026-07-24T01:00:00.000Z",
    });
    const active = createMemory();
    getAssetById.mockResolvedValueOnce(deleted).mockResolvedValueOnce(active);
    restoreAsset.mockResolvedValue(active);
    reprocessAsset.mockRejectedValue(new Error("queue unavailable"));

    await expect(service.restoreMemory(undefined, target)).rejects.toThrow(
      "queue unavailable"
    );
    expect(softDeleteAsset).toHaveBeenCalledWith("memory-v1");
    expect(vectorStore.deleteByIds).toHaveBeenCalledWith(["vector-v1"]);
  });
});
