import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssetNotFoundError } from "@/core/assets/errors";
import { WorkflowRunNotFoundError } from "@/core/workflows/errors";
import type { AppEnv } from "@/env";
import type { AssetDetail } from "@/features/assets/model/types";
import { registerAssetRoutes } from "@/features/assets/server/routes";
import * as assetService from "@/features/assets/server/service";
import * as workflowService from "@/features/workflows/server/service";

vi.mock("@/features/assets/server/service", () => {
  return {
    deleteAsset: vi.fn(),
    getAssetById: vi.fn(),
    listAssets: vi.fn(),
    restoreAsset: vi.fn(),
    updateAsset: vi.fn(),
  };
});

vi.mock("@/features/workflows/server/service", () => {
  return {
    getWorkflowRunDetail: vi.fn(),
    listWorkflowRunsByAssetId: vi.fn(),
  };
});

const createAssetDetail = (
  overrides: Partial<AssetDetail> = {}
): AssetDetail => {
  return {
    id: "asset-1",
    type: "note",
    title: "Test asset",
    summary: "Generated summary",
    sourceUrl: null,
    sourceKind: "manual",
    status: "ready",
    domain: "general",
    sensitivity: "internal",
    aiVisibility: "allow",
    retrievalPriority: 0,
    collectionKey: "inbox:notes",
    capturedAt: "2026-03-19T00:00:00.000Z",
    descriptorJson: null,
    createdAt: "2026-03-19T00:00:00.000Z",
    updatedAt: "2026-03-19T00:02:00.000Z",
    contentText: "CloudMind note body",
    rawR2Key: null,
    contentR2Key: null,
    mimeType: "text/plain",
    language: null,
    errorMessage: null,
    processedAt: "2026-03-19T00:02:00.000Z",
    failedAt: null,
    source: {
      kind: "manual",
      sourceUrl: null,
      metadataJson: null,
      createdAt: "2026-03-19T00:00:00.000Z",
    },
    jobs: [
      {
        id: "job-1",
        jobType: "extract_content",
        status: "succeeded",
        attempt: 0,
        errorMessage: null,
        createdAt: "2026-03-19T00:00:00.000Z",
        updatedAt: "2026-03-19T00:02:00.000Z",
      },
    ],
    chunks: [],
    ...overrides,
  };
};

const createApp = () => {
  const app = new Hono<AppEnv>();

  registerAssetRoutes(app);

  return app;
};

describe("asset routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/assets/:id returns the asset detail payload", async () => {
    const app = createApp();
    const item = createAssetDetail({
      id: "asset-route-detail",
      title: "Route detail asset",
      documentClass: "design_doc",
      sourceHost: "developers.cloudflare.com",
      facets: [
        {
          id: "facet-1",
          facetKey: "domain",
          facetValue: "engineering",
          facetLabel: "engineering",
          sortOrder: 0,
        },
      ],
      assertions: [
        {
          id: "assertion-1",
          assertionIndex: 0,
          kind: "summary_point",
          text: "CloudMind uses layered indexing to structure retrieval.",
          sourceChunkIndex: null,
          sourceSpanJson: null,
          confidence: 0.92,
          createdAt: "2026-03-19T00:01:00.000Z",
          updatedAt: "2026-03-19T00:01:00.000Z",
        },
      ],
    });
    const env = { APP_NAME: "cloudmind-test" };

    vi.mocked(assetService.getAssetById).mockResolvedValue(item);

    const response = await app.request(
      "/api/assets/asset-route-detail",
      undefined,
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ item });
    expect(assetService.getAssetById).toHaveBeenCalledWith(
      env,
      "asset-route-detail"
    );
  });

  it("GET /api/assets/:id/jobs returns the asset job list", async () => {
    const app = createApp();
    const item = createAssetDetail({
      id: "asset-jobs-1",
      jobs: [
        {
          id: "job-1",
          jobType: "extract_content",
          status: "succeeded",
          attempt: 0,
          errorMessage: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          updatedAt: "2026-03-19T00:02:00.000Z",
        },
        {
          id: "job-2",
          jobType: "summarize",
          status: "failed",
          attempt: 1,
          errorMessage: "AI timeout",
          createdAt: "2026-03-19T00:03:00.000Z",
          updatedAt: "2026-03-19T00:04:00.000Z",
        },
      ],
    });
    const env = { APP_NAME: "cloudmind-test" };

    vi.mocked(assetService.getAssetById).mockResolvedValue(item);

    const response = await app.request(
      "/api/assets/asset-jobs-1/jobs",
      {},
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: item.jobs,
    });
    expect(assetService.getAssetById).toHaveBeenCalledWith(env, "asset-jobs-1");
  });

  it("PATCH /api/assets/:id updates asset metadata", async () => {
    const app = createApp();
    const env = { APP_NAME: "cloudmind-test" };
    const item = createAssetDetail({
      id: "asset-edit-1",
      title: "Updated title",
      summary: "Updated summary",
      sourceUrl: "https://example.com/edited",
    });

    vi.mocked(assetService.updateAsset).mockResolvedValue(item);

    const response = await app.request(
      "/api/assets/asset-edit-1",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Updated title",
          summary: "Updated summary",
          sourceUrl: "https://example.com/edited",
        }),
      },
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      item,
    });
    expect(assetService.updateAsset).toHaveBeenCalledWith(env, "asset-edit-1", {
      title: "Updated title",
      summary: "Updated summary",
      sourceUrl: "https://example.com/edited",
    });
  });

  it("DELETE /api/assets/:id soft deletes the asset", async () => {
    const app = createApp();
    const env = { APP_NAME: "cloudmind-test" };

    const response = await app.request(
      "/api/assets/asset-delete-1",
      {
        method: "DELETE",
      },
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
    });
    expect(assetService.deleteAsset).toHaveBeenCalledWith(
      env,
      "asset-delete-1"
    );
  });

  it("GET /api/assets/:id/workflows returns workflow runs for the asset", async () => {
    const app = createApp();
    const item = createAssetDetail({
      id: "asset-workflows-1",
    });
    const env = { APP_NAME: "cloudmind-test" };

    vi.mocked(assetService.getAssetById).mockResolvedValue(item);
    vi.mocked(workflowService.listWorkflowRunsByAssetId).mockResolvedValue([
      {
        id: "run-1",
        assetId: "asset-workflows-1",
        workflowType: "note_ingest_v1",
        triggerType: "ingest",
        status: "succeeded",
        stateJson: "{}",
        currentStep: null,
        errorMessage: null,
        startedAt: "2026-03-20T00:01:00.000Z",
        finishedAt: "2026-03-20T00:02:00.000Z",
        createdAt: "2026-03-20T00:00:00.000Z",
        updatedAt: "2026-03-20T00:02:00.000Z",
      },
    ]);

    const response = await app.request(
      "/api/assets/asset-workflows-1/workflows",
      undefined,
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: "run-1",
          assetId: "asset-workflows-1",
          workflowType: "note_ingest_v1",
        }),
      ],
    });
    expect(assetService.getAssetById).toHaveBeenCalledWith(
      env,
      "asset-workflows-1"
    );
    expect(workflowService.listWorkflowRunsByAssetId).toHaveBeenCalledWith(
      env,
      "asset-workflows-1"
    );
  });

  it("GET /api/workflows/:id returns workflow run detail", async () => {
    const app = createApp();
    const env = { APP_NAME: "cloudmind-test" };

    vi.mocked(workflowService.getWorkflowRunDetail).mockResolvedValue({
      run: {
        id: "run-1",
        assetId: "asset-1",
        workflowType: "pdf_ingest_v1",
        triggerType: "reprocess",
        status: "failed",
        stateJson: '{"summary":"partial"}',
        currentStep: "embed",
        errorMessage: "Embedding timeout",
        startedAt: "2026-03-20T00:01:00.000Z",
        finishedAt: "2026-03-20T00:03:00.000Z",
        createdAt: "2026-03-20T00:00:00.000Z",
        updatedAt: "2026-03-20T00:03:00.000Z",
      },
      steps: [
        {
          id: "step-1",
          runId: "run-1",
          assetId: "asset-1",
          stepKey: "load_source",
          stepType: "load_source",
          status: "succeeded",
          attempt: 1,
          inputJson: null,
          outputJson: '{"rawR2Key":"assets/a.pdf"}',
          errorMessage: null,
          startedAt: "2026-03-20T00:01:00.000Z",
          finishedAt: "2026-03-20T00:01:10.000Z",
          createdAt: "2026-03-20T00:00:00.000Z",
          updatedAt: "2026-03-20T00:01:10.000Z",
        },
      ],
      artifacts: [
        {
          id: "artifact-1",
          assetId: "asset-1",
          artifactType: "summary",
          version: 1,
          storageKind: "inline",
          r2Key: null,
          contentText: "Partial summary",
          metadataJson: null,
          createdByRunId: "run-1",
          createdAt: "2026-03-20T00:01:30.000Z",
        },
      ],
    });

    const response = await app.request("/api/workflows/run-1", undefined, env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      item: expect.objectContaining({
        run: expect.objectContaining({
          id: "run-1",
          workflowType: "pdf_ingest_v1",
        }),
        steps: expect.any(Array),
        artifacts: expect.any(Array),
      }),
    });
    expect(workflowService.getWorkflowRunDetail).toHaveBeenCalledWith(
      env,
      "run-1"
    );
  });

  it("GET /api/assets/:id returns 404 when the asset does not exist", async () => {
    const app = createApp();

    vi.mocked(assetService.getAssetById).mockRejectedValue(
      new AssetNotFoundError("missing-asset")
    );

    const response = await app.request("/api/assets/missing-asset");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "ASSET_NOT_FOUND",
        message: "Asset not found",
      },
    });
  });

  it("GET /api/assets/:id/jobs returns 404 when the asset does not exist", async () => {
    const app = createApp();

    vi.mocked(assetService.getAssetById).mockRejectedValue(
      new AssetNotFoundError("missing-asset")
    );

    const response = await app.request("/api/assets/missing-asset/jobs");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "ASSET_NOT_FOUND",
        message: "Asset not found",
      },
    });
  });

  it("GET /api/assets/:id/workflows returns 404 when the asset does not exist", async () => {
    const app = createApp();

    vi.mocked(assetService.getAssetById).mockRejectedValue(
      new AssetNotFoundError("missing-asset")
    );

    const response = await app.request("/api/assets/missing-asset/workflows");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "ASSET_NOT_FOUND",
        message: "Asset not found",
      },
    });
  });

  it("GET /api/workflows/:id returns 404 when the run does not exist", async () => {
    const app = createApp();

    vi.mocked(workflowService.getWorkflowRunDetail).mockRejectedValue(
      new WorkflowRunNotFoundError("missing-run")
    );

    const response = await app.request("/api/workflows/missing-run");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "WORKFLOW_RUN_NOT_FOUND",
        message: "Workflow run not found",
      },
    });
  });

  it("PATCH /api/assets/:id returns 404 when the asset does not exist", async () => {
    const app = createApp();

    vi.mocked(assetService.updateAsset).mockRejectedValue(
      new AssetNotFoundError("missing-asset")
    );

    const response = await app.request("/api/assets/missing-asset", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Updated title",
      }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "ASSET_NOT_FOUND",
        message: "Asset not found",
      },
    });
  });

  it("DELETE /api/assets/:id returns 404 when the asset does not exist", async () => {
    const app = createApp();

    vi.mocked(assetService.deleteAsset).mockRejectedValue(
      new AssetNotFoundError("missing-asset")
    );

    const response = await app.request("/api/assets/missing-asset", {
      method: "DELETE",
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "ASSET_NOT_FOUND",
        message: "Asset not found",
      },
    });
  });

  it("PATCH /api/assets/:id returns 400 for invalid input", async () => {
    const app = createApp();

    const response = await app.request("/api/assets/asset-edit-1", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: expect.objectContaining({
        code: "INVALID_INPUT",
        message: "Invalid request payload",
      }),
    });
    expect(assetService.updateAsset).not.toHaveBeenCalled();
  });

  it("POST /api/assets/:id/restore restores an asset", async () => {
    const app = createApp();
    const env = { APP_NAME: "cloudmind-test" };

    vi.mocked(assetService.restoreAsset).mockResolvedValue(
      createAssetDetail({
        id: "asset-restore-1",
        title: "Restored asset",
      })
    );

    const response = await app.request("/api/assets/asset-restore-1/restore", {
      method: "POST",
    }, env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      item: expect.objectContaining({
        id: "asset-restore-1",
        title: "Restored asset",
      }),
    });
    expect(assetService.restoreAsset).toHaveBeenCalledWith(
      env,
      "asset-restore-1"
    );
  });

  it("GET /api/assets passes list filters to the service", async () => {
    const app = createApp();
    const env = { APP_NAME: "cloudmind-test" };

    vi.mocked(assetService.listAssets).mockResolvedValue({
      items: [
        createAssetDetail({
          id: "asset-filter-1",
          type: "url",
          title: "Filtered asset",
        }),
      ],
      pagination: {
        page: 2,
        pageSize: 10,
        total: 21,
        totalPages: 3,
      },
    });

    const response = await app.request(
      "/api/assets?status=ready&type=url&domain=engineering&documentClass=howto&sourceKind=manual&aiVisibility=allow&sourceHost=developers.cloudflare.com&query=cloudflare&page=2&pageSize=10",
      undefined,
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: "asset-filter-1",
          title: "Filtered asset",
        }),
      ],
      pagination: {
        page: 2,
        pageSize: 10,
        total: 21,
        totalPages: 3,
      },
    });
    expect(assetService.listAssets).toHaveBeenCalledWith(env, {
      status: "ready",
      type: "url",
      domain: "engineering",
      documentClass: "howto",
      sourceKind: "manual",
      aiVisibility: "allow",
      sourceHost: "developers.cloudflare.com",
      query: "cloudflare",
      page: 2,
      pageSize: 10,
    });
  });
});
