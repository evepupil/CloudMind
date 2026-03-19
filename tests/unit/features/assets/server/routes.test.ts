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
    ingestFileAsset: vi.fn(),
    ingestTextAsset: vi.fn(),
    ingestUrlAsset: vi.fn(),
    listAssets: vi.fn(),
    reprocessAsset: vi.fn(),
    searchAssets: vi.fn(),
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
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
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
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({
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
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({
      error: {
        code: "ASSET_NOT_FOUND",
        message: "Asset not found",
      },
    });
  });

  it("POST /api/ingest/url returns 201 with the created URL asset payload", async () => {
    const app = createApp();
    const item = createAssetDetail({
      id: "asset-url-1",
      type: "url",
      title: "Cloudflare Docs",
      sourceUrl: "https://developers.cloudflare.com",
    });
    const env = { APP_NAME: "cloudmind-test" };

    vi.mocked(assetService.ingestUrlAsset).mockResolvedValue(item);

    const response = await app.request(
      "/api/ingest/url",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Cloudflare Docs",
          url: "https://developers.cloudflare.com",
        }),
      },
      env
    );

    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual({
      ok: true,
      item: {
        id: "asset-url-1",
        type: "url",
        title: "Cloudflare Docs",
        status: "ready",
        createdAt: "2026-03-19T00:00:00.000Z",
      },
    });
    expect(assetService.ingestUrlAsset).toHaveBeenCalledWith(env, {
      title: "Cloudflare Docs",
      url: "https://developers.cloudflare.com",
    });
  });

  it("POST /api/ingest/file stores a PDF asset", async () => {
    const app = createApp();
    const env = { APP_NAME: "cloudmind-test" };
    const item = createAssetDetail({
      id: "asset-file-1",
      type: "pdf",
      title: "CloudMind Spec",
      status: "pending",
      mimeType: "application/pdf",
      contentText: null,
      processedAt: null,
      summary: null,
    });
    const formData = new FormData();

    formData.set("title", "CloudMind Spec");
    formData.set(
      "file",
      new File(["pdf-bytes"], "cloudmind-spec.pdf", {
        type: "application/pdf",
      })
    );

    vi.mocked(assetService.ingestFileAsset).mockResolvedValue(item);

    const response = await app.request(
      "/api/ingest/file",
      {
        method: "POST",
        body: formData,
      },
      env
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual({
      ok: true,
      item: {
        id: "asset-file-1",
        type: "pdf",
        title: "CloudMind Spec",
        status: "pending",
        createdAt: "2026-03-19T00:00:00.000Z",
      },
    });
    expect(assetService.ingestFileAsset).toHaveBeenCalledWith(
      env,
      expect.objectContaining({
        title: "CloudMind Spec",
        file: expect.any(File),
      })
    );
  });

  it("POST /api/ingest/file returns 400 for non-PDF uploads", async () => {
    const app = createApp();
    const formData = new FormData();

    formData.set(
      "file",
      new File(["plain-text"], "notes.txt", {
        type: "text/plain",
      })
    );

    const response = await app.request("/api/ingest/file", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: {
        code: "INVALID_INPUT",
        message: "Only PDF files are supported right now.",
      },
    });
    expect(assetService.ingestFileAsset).not.toHaveBeenCalled();
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
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
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

  it("POST /api/assets/:id/process returns the reprocessed asset", async () => {
    const app = createApp();
    const env = { APP_NAME: "cloudmind-test" };
    const item = createAssetDetail({
      id: "asset-reprocess-1",
      status: "ready",
      summary: "Reprocessed summary",
    });

    vi.mocked(assetService.reprocessAsset).mockResolvedValue(item);

    const response = await app.request(
      "/api/assets/asset-reprocess-1/process",
      {
        method: "POST",
      },
      env
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      item,
    });
    expect(assetService.reprocessAsset).toHaveBeenCalledWith(
      env,
      "asset-reprocess-1"
    );
  });

  it("POST /assets/actions/:id/process redirects back to the detail page", async () => {
    const app = createApp();
    const env = { APP_NAME: "cloudmind-test" };
    const item = createAssetDetail({
      id: "asset-reprocess-form-1",
    });

    vi.mocked(assetService.reprocessAsset).mockResolvedValue(item);

    const response = await app.request(
      "/assets/actions/asset-reprocess-form-1/process",
      {
        method: "POST",
      },
      env
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "/assets/asset-reprocess-form-1?reprocessed=1"
    );
    expect(assetService.reprocessAsset).toHaveBeenCalledWith(
      env,
      "asset-reprocess-form-1"
    );
  });

  it("POST /assets/actions/:id/process redirects with an error when the asset is missing", async () => {
    const app = createApp();

    vi.mocked(assetService.reprocessAsset).mockRejectedValue(
      new AssetNotFoundError("missing-asset")
    );

    const response = await app.request(
      "/assets/actions/missing-asset/process",
      {
        method: "POST",
      }
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "/assets/missing-asset?error=Asset%20not%20found."
    );
  });

  it("POST /api/search returns keyword search results", async () => {
    const app = createApp();
    const env = { APP_NAME: "cloudmind-test" };

    vi.mocked(assetService.searchAssets).mockResolvedValue({
      items: [
        createAssetDetail({
          id: "asset-search-1",
          title: "Search result asset",
        }),
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    });

    const response = await app.request(
      "/api/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: "cloudmind",
          page: 1,
          pageSize: 20,
        }),
      },
      env
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      items: [
        expect.objectContaining({
          id: "asset-search-1",
          title: "Search result asset",
        }),
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    });
    expect(assetService.searchAssets).toHaveBeenCalledWith(env, {
      query: "cloudmind",
      page: 1,
      pageSize: 20,
    });
  });
});
