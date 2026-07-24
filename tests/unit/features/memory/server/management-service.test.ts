import { describe, expect, it, vi } from "vitest";

import type { AssetRepository } from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
import type { AssetDetail } from "@/features/assets/model/types";
import { memoryManagementQuerySchema } from "@/features/memory/server/management-schemas";
import { createMemoryManagementService } from "@/features/memory/server/management-service";

const contextKey = "project:github:evepupil/CloudMind";

const createMemory = (overrides: Partial<AssetDetail> = {}): AssetDetail => ({
  id: "memory-v2",
  type: "note",
  title: "CloudMind M3",
  summary: "M3-A3",
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
  memoryVersion: 2,
  previousVersionId: "memory-v1",
  supersededById: null,
  supersededAt: null,
  deletedAt: null,
  sourceHost: null,
  collectionKey: null,
  capturedAt: "2026-07-24T00:00:00.000Z",
  createdAt: "2026-07-24T00:00:00.000Z",
  updatedAt: "2026-07-24T00:00:00.000Z",
  contentText: "D1 preview",
  rawR2Key: "assets/memory-v2/raw/input.txt",
  contentR2Key: "assets/memory-v2/content.txt",
  mimeType: "text/plain",
  language: "zh",
  errorMessage: null,
  processedAt: "2026-07-24T00:00:00.000Z",
  failedAt: null,
  source: null,
  jobs: [],
  chunks: [],
  ...overrides,
});

describe("memory management service", () => {
  it("applies the Agent memory defaults and returns project summaries", async () => {
    const listAssets = vi.fn<AssetRepository["listAssets"]>(async () => ({
      items: [createMemory()],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    }));
    const listRecordContexts = vi.fn(async () => [
      {
        contextKey,
        activeCount: 1,
        forgottenCount: 0,
        personalCount: 0,
        agentCount: 1,
        latestUpdatedAt: "2026-07-24T00:00:00.000Z",
      },
    ]);
    const repository = {
      listAssets,
      listRecordContexts,
      listMemoryVersions: vi.fn(),
    } as unknown as AssetRepository;
    const service = createMemoryManagementService({
      getAssetRepository: vi.fn(async () => repository),
      getBlobStore: vi.fn(),
    });

    const result = await service.listManagedRecords(undefined, {});

    expect(listAssets).toHaveBeenCalledWith({
      recordKinds: ["memory"],
      scopeIds: ["agent"],
      deleted: "exclude",
      page: 1,
      pageSize: 20,
    });
    expect(listRecordContexts).toHaveBeenCalledWith({
      recordKinds: ["memory"],
      scopeIds: ["agent"],
      deleted: "exclude",
    });
    expect(result.contexts).toEqual(
      await listRecordContexts.mock.results[0]?.value
    );
  });

  it("loads deleted records, immutable content and the exact version chain", async () => {
    const item = createMemory({ deletedAt: "2026-07-24T01:00:00.000Z" });
    const getAssetById = vi.fn<AssetRepository["getAssetById"]>(
      async () => item
    );
    const listMemoryVersions = vi.fn(async () => [item]);
    const repository = {
      getAssetById,
      listRecordContexts: vi.fn(),
      listMemoryVersions,
    } as unknown as AssetRepository;
    const blobStore: BlobStore = {
      put: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(async () => ({
        key: item.contentR2Key ?? "",
        body: new TextEncoder().encode("R2 immutable content")
          .buffer as ArrayBuffer,
        size: 20,
      })),
    };
    const service = createMemoryManagementService({
      getAssetRepository: vi.fn(async () => repository),
      getBlobStore: vi.fn(async () => blobStore),
    });

    const result = await service.getManagedMemory(undefined, item.id);

    expect(getAssetById).toHaveBeenCalledWith(item.id, {
      includeDeleted: true,
    });
    expect(listMemoryVersions).toHaveBeenCalledWith({
      memoryRootId: "memory-v1",
      scopeId: "agent",
      contextKey,
    });
    expect(result.item.contentText).toBe("R2 immutable content");
    expect(result.versions).toEqual([item]);
  });

  it("rejects a library asset on the dedicated memory detail path", async () => {
    const repository = {
      getAssetById: vi.fn(async () =>
        createMemory({ recordKind: "library", memoryRootId: null })
      ),
      listRecordContexts: vi.fn(),
      listMemoryVersions: vi.fn(),
    } as unknown as AssetRepository;
    const service = createMemoryManagementService({
      getAssetRepository: vi.fn(async () => repository),
      getBlobStore: vi.fn(),
    });

    await expect(
      service.getManagedMemory(undefined, "library-1")
    ).rejects.toMatchObject({ code: "NOT_MEMORY" });
  });
});

describe("memory management query schema", () => {
  it("parses repeated GET parameters as composable arrays", () => {
    expect(
      memoryManagementQuerySchema.parse({
        recordKinds: ["library", "memory"],
        scopeIds: ["personal", "agent"],
        contextKeys: [contextKey],
        deleted: ["include"],
        page: ["2"],
      })
    ).toEqual({
      recordKinds: ["library", "memory"],
      scopeIds: ["personal", "agent"],
      contextKeys: [contextKey],
      deleted: "include",
      page: 2,
    });
  });
});
