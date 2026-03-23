import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssetNotFoundError } from "@/core/assets/errors";
import type { AppEnv } from "@/env";
import type { AssetDetail } from "@/features/assets/model/types";
import { registerIngestRoutes } from "@/features/ingest/server/routes";
import * as ingestService from "@/features/ingest/server/service";

vi.mock("@/features/ingest/server/service", () => {
  return {
    backfillChunkContent: vi.fn(),
    ingestFileAsset: vi.fn(),
    ingestTextAsset: vi.fn(),
    ingestUrlAsset: vi.fn(),
    reprocessAsset: vi.fn(),
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

  registerIngestRoutes(app);

  return app;
};

describe("ingest routes", () => {
  const env = { APP_NAME: "cloudmind-test" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/ingest/text returns 201 with the created asset payload", async () => {
    const app = createApp();
    const item = createAssetDetail();

    vi.mocked(ingestService.ingestTextAsset).mockResolvedValue(item);

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

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      item: {
        id: "asset-1",
        type: "note",
        title: "Test asset",
        status: "ready",
        createdAt: "2026-03-19T00:00:00.000Z",
      },
    });
    expect(ingestService.ingestTextAsset).toHaveBeenCalledWith(env, {
      title: "Research note",
      content: "CloudMind route test content",
    });
  });

  it("POST /api/ingest/text forwards optional enrichment to the ingest service", async () => {
    const app = createApp();
    const item = createAssetDetail();

    vi.mocked(ingestService.ingestTextAsset).mockResolvedValue(item);

    const response = await app.request(
      "/api/ingest/text",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Structured note",
          content: "CloudMind should keep this text.",
          enrichment: {
            summary: "User provided summary",
            domain: "engineering",
            documentClass: "design_doc",
            descriptor: {
              topics: ["workflow", "mcp"],
              collectionKey: "project/cloudmind",
              signals: ["manual_seed"],
            },
            facets: [
              {
                facetKey: "topic",
                facetValue: "workflow",
                facetLabel: "workflow",
              },
            ],
          },
        }),
      },
      env
    );

    expect(response.status).toBe(201);
    expect(ingestService.ingestTextAsset).toHaveBeenCalledWith(env, {
      title: "Structured note",
      content: "CloudMind should keep this text.",
      enrichment: {
        summary: "User provided summary",
        domain: "engineering",
        documentClass: "design_doc",
        descriptor: {
          topics: ["workflow", "mcp"],
          collectionKey: "project/cloudmind",
          signals: ["manual_seed"],
        },
        facets: [
          {
            facetKey: "topic",
            facetValue: "workflow",
            facetLabel: "workflow",
          },
        ],
      },
    });
  });

  it("POST /api/ingest/url returns 201 with the created asset payload", async () => {
    const app = createApp();
    const item = createAssetDetail({
      id: "asset-url-1",
      type: "url",
      title: "Cloudflare Docs",
      sourceUrl: "https://developers.cloudflare.com",
    });

    vi.mocked(ingestService.ingestUrlAsset).mockResolvedValue(item);

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

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      item: {
        id: "asset-url-1",
        type: "url",
        title: "Cloudflare Docs",
        status: "ready",
        createdAt: "2026-03-19T00:00:00.000Z",
      },
    });
    expect(ingestService.ingestUrlAsset).toHaveBeenCalledWith(env, {
      title: "Cloudflare Docs",
      url: "https://developers.cloudflare.com",
    });
  });

  it("POST /api/ingest/file stores a PDF asset", async () => {
    const app = createApp();
    const item = createAssetDetail({
      id: "asset-file-1",
      type: "pdf",
      title: "CloudMind Spec",
      mimeType: "application/pdf",
      contentText: "Hello CloudMind PDF",
      rawR2Key: "assets/asset-file-1/raw/cloudmind-spec.pdf",
      summary: "Hello CloudMind PDF",
    });
    const formData = new FormData();

    formData.set("title", "CloudMind Spec");
    formData.set(
      "file",
      new File(["pdf-bytes"], "cloudmind-spec.pdf", {
        type: "application/pdf",
      })
    );

    vi.mocked(ingestService.ingestFileAsset).mockResolvedValue(item);

    const response = await app.request(
      "/api/ingest/file",
      {
        method: "POST",
        body: formData,
      },
      env
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      item: {
        id: "asset-file-1",
        type: "pdf",
        title: "CloudMind Spec",
        status: "ready",
        createdAt: "2026-03-19T00:00:00.000Z",
      },
    });
    expect(ingestService.ingestFileAsset).toHaveBeenCalledWith(
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

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_INPUT",
        message: "Only PDF files are supported right now.",
      },
    });
    expect(ingestService.ingestFileAsset).not.toHaveBeenCalled();
  });

  it("POST /api/assets/:id/process returns the reprocessed asset", async () => {
    const app = createApp();
    const item = createAssetDetail({
      id: "asset-reprocess-1",
      summary: "Reprocessed summary",
    });

    vi.mocked(ingestService.reprocessAsset).mockResolvedValue(item);

    const response = await app.request(
      "/api/assets/asset-reprocess-1/process",
      {
        method: "POST",
      },
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      item,
    });
    expect(ingestService.reprocessAsset).toHaveBeenCalledWith(
      env,
      "asset-reprocess-1"
    );
  });

  it("POST /api/assets/:id/process returns 404 when the asset is missing", async () => {
    const app = createApp();

    vi.mocked(ingestService.reprocessAsset).mockRejectedValue(
      new AssetNotFoundError("missing-asset")
    );

    const response = await app.request("/api/assets/missing-asset/process", {
      method: "POST",
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "ASSET_NOT_FOUND",
        message: "Asset not found",
      },
    });
  });

  it("POST /api/assets/backfill/chunks returns the backfill summary", async () => {
    const app = createApp();

    vi.mocked(ingestService.backfillChunkContent).mockResolvedValue({
      dryRun: true,
      candidateAssetIds: ["asset-note-1", "asset-pdf-1"],
      processedAssetIds: [],
      failedItems: [],
    });

    const response = await app.request(
      "/api/assets/backfill/chunks",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dryRun: true,
          limit: 10,
        }),
      },
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      dryRun: true,
      candidateAssetIds: ["asset-note-1", "asset-pdf-1"],
      processedAssetIds: [],
      failedItems: [],
    });
    expect(ingestService.backfillChunkContent).toHaveBeenCalledWith(env, {
      dryRun: true,
      limit: 10,
    });
  });

  it("POST /api/assets/backfill/chunks returns 400 for invalid payload", async () => {
    const app = createApp();

    const response = await app.request("/api/assets/backfill/chunks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dryRun: "yes",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: expect.objectContaining({
        code: "INVALID_INPUT",
        message: "Invalid request payload",
      }),
    });
    expect(ingestService.backfillChunkContent).not.toHaveBeenCalled();
  });

  it("POST /assets/actions/ingest-text redirects to the detail page after creation", async () => {
    const app = createApp();
    const item = createAssetDetail({
      id: "asset-text-form-1",
    });
    const formData = new FormData();

    formData.set("title", "Meeting note");
    formData.set("content", "CloudMind saves this text.");

    vi.mocked(ingestService.ingestTextAsset).mockResolvedValue(item);

    const response = await app.request(
      "/assets/actions/ingest-text",
      {
        method: "POST",
        body: formData,
      },
      env
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "/assets/asset-text-form-1?created=1"
    );
  });

  it("POST /assets/actions/ingest-url redirects with an error for invalid URLs", async () => {
    const app = createApp();
    const formData = new FormData();

    formData.set("title", "Broken URL");
    formData.set("url", "not-a-url");

    const response = await app.request("/assets/actions/ingest-url", {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "/assets?error=Please%20provide%20a%20valid%20URL."
    );
  });

  it("POST /assets/actions/ingest-file redirects to the detail page after upload", async () => {
    const app = createApp();
    const item = createAssetDetail({
      id: "asset-file-form-1",
      type: "pdf",
      title: "CloudMind Whitepaper",
      contentText: "Hello CloudMind PDF",
      rawR2Key: "assets/asset-file-form-1/raw/cloudmind-whitepaper.pdf",
      summary: "Hello CloudMind PDF",
    });
    const formData = new FormData();

    formData.set("title", "CloudMind Whitepaper");
    formData.set(
      "file",
      new File(["pdf-bytes"], "cloudmind-whitepaper.pdf", {
        type: "application/pdf",
      })
    );

    vi.mocked(ingestService.ingestFileAsset).mockResolvedValue(item);

    const response = await app.request(
      "/assets/actions/ingest-file",
      {
        method: "POST",
        body: formData,
      },
      env
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "/assets/asset-file-form-1?created=1"
    );
  });

  it("POST /assets/actions/:id/process redirects back to the detail page", async () => {
    const app = createApp();
    const item = createAssetDetail({
      id: "asset-reprocess-form-1",
    });

    vi.mocked(ingestService.reprocessAsset).mockResolvedValue(item);

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
  });

  it("POST /assets/actions/:id/process redirects with an error when the asset is missing", async () => {
    const app = createApp();

    vi.mocked(ingestService.reprocessAsset).mockRejectedValue(
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
});
