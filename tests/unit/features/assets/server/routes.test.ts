import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppEnv } from "@/env";
import type { AssetDetail } from "@/features/assets/model/types";
import { AssetNotFoundError } from "@/features/assets/server/repository";
import { registerAssetRoutes } from "@/features/assets/server/routes";
import * as assetService from "@/features/assets/server/service";

vi.mock("@/features/assets/server/service", () => {
  return {
    getAssetById: vi.fn(),
    ingestTextAsset: vi.fn(),
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

  it("POST /api/ingest/text returns 201 with the created asset payload", async () => {
    const app = createApp();
    const item = createAssetDetail();
    const env = { APP_NAME: "cloudmind-test" };

    vi.mocked(assetService.ingestTextAsset).mockResolvedValue(item);

    const response = await app.request(
      "/api/ingest/text",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Research note",
          content: "CloudMind route test content",
        }),
      },
      env
    );

    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual({
      ok: true,
      item: {
        id: "asset-1",
        type: "note",
        title: "Test asset",
        status: "ready",
        createdAt: "2026-03-19T00:00:00.000Z",
      },
    });
    expect(assetService.ingestTextAsset).toHaveBeenCalledWith(env, {
      title: "Research note",
      content: "CloudMind route test content",
    });
  });

  it("POST /api/ingest/text returns 400 for invalid input", async () => {
    const app = createApp();

    const response = await app.request("/api/ingest/text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Broken note",
        content: "   ",
      }),
    });

    const payload = (await response.json()) as {
      error: {
        code: string;
      };
    };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("INVALID_INPUT");
    expect(assetService.ingestTextAsset).not.toHaveBeenCalled();
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

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ item });
    expect(assetService.getAssetById).toHaveBeenCalledWith(
      env,
      "asset-route-detail"
    );
  });

  it("GET /api/assets/:id returns 404 when the asset does not exist", async () => {
    const app = createApp();

    vi.mocked(assetService.getAssetById).mockRejectedValue(
      new AssetNotFoundError("missing-asset")
    );

    const response = await app.request("/api/assets/missing-asset");
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({
      error: {
        code: "ASSET_NOT_FOUND",
        message: "Asset not found",
      },
    });
  });
});
