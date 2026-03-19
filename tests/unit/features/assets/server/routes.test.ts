import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssetNotFoundError } from "@/core/assets/errors";
import type { AppEnv } from "@/env";
import type { AssetDetail } from "@/features/assets/model/types";
import { registerAssetRoutes } from "@/features/assets/server/routes";
import * as assetService from "@/features/assets/server/service";

vi.mock("@/features/assets/server/service", () => {
  return {
    getAssetById: vi.fn(),
    listAssets: vi.fn(),
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
    status: "ready",
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
      "/api/assets?status=ready&type=url&query=cloudflare&page=2&pageSize=10",
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
      query: "cloudflare",
      page: 2,
      pageSize: 10,
    });
  });
});
