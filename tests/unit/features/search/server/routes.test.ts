import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppEnv } from "@/env";
import { registerSearchRoutes } from "@/features/search/server/routes";
import * as searchService from "@/features/search/server/service";

vi.mock("@/features/search/server/service", () => {
  return {
    searchAssets: vi.fn(),
  };
});

const createApp = () => {
  const app = new Hono<AppEnv>();

  registerSearchRoutes(app);

  return app;
};

describe("search routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/search returns semantic search results", async () => {
    const app = createApp();
    const env = { APP_NAME: "cloudmind-test" };

    vi.mocked(searchService.searchAssets).mockResolvedValue({
      items: [
        {
          kind: "chunk",
          score: 0.96,
          indexing: {
            matchedLayer: "chunk",
            domain: "engineering",
            documentClass: "design_doc",
            sourceHost: "developers.cloudflare.com",
            collectionKey: "inbox:notes",
            aiVisibility: "allow",
            sourceKind: "manual",
            topics: ["cloudflare", "database"],
            assertionKind: null,
          },
          chunk: {
            id: "chunk-1",
            chunkIndex: 0,
            textPreview: "Search result excerpt",
            vectorId: "asset-search-1:0",
            asset: {
              id: "asset-search-1",
              type: "note",
              title: "Search result asset",
              summary: "Search summary",
              sourceUrl: null,
              sourceKind: "manual",
              status: "ready",
              domain: "engineering",
              sensitivity: "internal",
              aiVisibility: "allow",
              retrievalPriority: 10,
              documentClass: "design_doc",
              sourceHost: "developers.cloudflare.com",
              collectionKey: "inbox:notes",
              capturedAt: "2026-03-19T00:00:00.000Z",
              descriptorJson: null,
              createdAt: "2026-03-19T00:00:00.000Z",
              updatedAt: "2026-03-19T00:00:00.000Z",
            },
          },
        },
      ],
      evidence: {
        items: [
          {
            id: "chunk:chunk-1",
            layer: "chunk",
            score: 0.96,
            text: "Search result excerpt",
            snippet: "Search result excerpt",
            chunkId: "chunk-1",
            chunkIndex: 0,
            vectorId: "asset-search-1:0",
            source: {
              sourceUrl: null,
              sourceKind: "manual",
              sourceHost: "developers.cloudflare.com",
              capturedAt: "2026-03-19T00:00:00.000Z",
            },
            visibility: {
              aiVisibility: "allow",
              sensitivity: "internal",
            },
            matchReasons: [
              {
                code: "semantic_match",
                label: "Semantic match",
                detail: "Matched the query against embedded chunk content.",
              },
            ],
            indexing: {
              matchedLayer: "chunk",
              domain: "engineering",
              documentClass: "design_doc",
              sourceHost: "developers.cloudflare.com",
              collectionKey: "inbox:notes",
              aiVisibility: "allow",
              sourceKind: "manual",
              topics: ["cloudflare", "database"],
              assertionKind: null,
            },
            asset: {
              id: "asset-search-1",
              type: "note",
              title: "Search result asset",
              summary: "Search summary",
              sourceUrl: null,
              sourceKind: "manual",
              status: "ready",
              domain: "engineering",
              sensitivity: "internal",
              aiVisibility: "allow",
              retrievalPriority: 10,
              documentClass: "design_doc",
              sourceHost: "developers.cloudflare.com",
              collectionKey: "inbox:notes",
              capturedAt: "2026-03-19T00:00:00.000Z",
              descriptorJson: null,
              createdAt: "2026-03-19T00:00:00.000Z",
              updatedAt: "2026-03-19T00:00:00.000Z",
            },
          },
        ],
      },
      groupedEvidence: [
        {
          asset: {
            id: "asset-search-1",
            type: "note",
            title: "Search result asset",
            summary: "Search summary",
            sourceUrl: null,
            sourceKind: "manual",
            status: "ready",
            domain: "engineering",
            sensitivity: "internal",
            aiVisibility: "allow",
            retrievalPriority: 10,
            documentClass: "design_doc",
            sourceHost: "developers.cloudflare.com",
            collectionKey: "inbox:notes",
            capturedAt: "2026-03-19T00:00:00.000Z",
            descriptorJson: null,
            createdAt: "2026-03-19T00:00:00.000Z",
            updatedAt: "2026-03-19T00:00:00.000Z",
          },
          assetScore: 0.96,
          topScore: 0.96,
          matchedLayers: ["chunk"],
          groupSummary: {
            headline: "Semantic match led this asset",
            bullets: ["Primary signal: Semantic match."],
          },
          primaryEvidence: {
            id: "chunk:chunk-1",
            layer: "chunk",
            score: 0.96,
            text: "Search result excerpt",
            snippet: "Search result excerpt",
            chunkId: "chunk-1",
            chunkIndex: 0,
            vectorId: "asset-search-1:0",
            source: {
              sourceUrl: null,
              sourceKind: "manual",
              sourceHost: "developers.cloudflare.com",
              capturedAt: "2026-03-19T00:00:00.000Z",
            },
            visibility: {
              aiVisibility: "allow",
              sensitivity: "internal",
            },
            matchReasons: [
              {
                code: "semantic_match",
                label: "Semantic match",
                detail: "Matched the query against embedded chunk content.",
              },
            ],
            indexing: {
              matchedLayer: "chunk",
              domain: "engineering",
              documentClass: "design_doc",
              sourceHost: "developers.cloudflare.com",
              collectionKey: "inbox:notes",
              aiVisibility: "allow",
              sourceKind: "manual",
              topics: ["cloudflare", "database"],
              assertionKind: null,
            },
            asset: {
              id: "asset-search-1",
              type: "note",
              title: "Search result asset",
              summary: "Search summary",
              sourceUrl: null,
              sourceKind: "manual",
              status: "ready",
              domain: "engineering",
              sensitivity: "internal",
              aiVisibility: "allow",
              retrievalPriority: 10,
              documentClass: "design_doc",
              sourceHost: "developers.cloudflare.com",
              collectionKey: "inbox:notes",
              capturedAt: "2026-03-19T00:00:00.000Z",
              descriptorJson: null,
              createdAt: "2026-03-19T00:00:00.000Z",
              updatedAt: "2026-03-19T00:00:00.000Z",
            },
          },
          items: [
            {
              id: "chunk:chunk-1",
              layer: "chunk",
              score: 0.96,
              text: "Search result excerpt",
              snippet: "Search result excerpt",
              chunkId: "chunk-1",
              chunkIndex: 0,
              vectorId: "asset-search-1:0",
              source: {
                sourceUrl: null,
                sourceKind: "manual",
                sourceHost: "developers.cloudflare.com",
                capturedAt: "2026-03-19T00:00:00.000Z",
              },
              visibility: {
                aiVisibility: "allow",
                sensitivity: "internal",
              },
              matchReasons: [
                {
                  code: "semantic_match",
                  label: "Semantic match",
                  detail: "Matched the query against embedded chunk content.",
                },
              ],
              indexing: {
                matchedLayer: "chunk",
                domain: "engineering",
                documentClass: "design_doc",
                sourceHost: "developers.cloudflare.com",
                collectionKey: "inbox:notes",
                aiVisibility: "allow",
                sourceKind: "manual",
                topics: ["cloudflare", "database"],
                assertionKind: null,
              },
              asset: {
                id: "asset-search-1",
                type: "note",
                title: "Search result asset",
                summary: "Search summary",
                sourceUrl: null,
                sourceKind: "manual",
                status: "ready",
                domain: "engineering",
                sensitivity: "internal",
                aiVisibility: "allow",
                retrievalPriority: 10,
                documentClass: "design_doc",
                sourceHost: "developers.cloudflare.com",
                collectionKey: "inbox:notes",
                capturedAt: "2026-03-19T00:00:00.000Z",
                descriptorJson: null,
                createdAt: "2026-03-19T00:00:00.000Z",
                updatedAt: "2026-03-19T00:00:00.000Z",
              },
            },
          ],
        },
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
          domain: "engineering",
          documentClass: "design_doc",
          sourceKind: "manual",
          sourceHost: "developers.cloudflare.com",
          topic: "cloudflare",
          tag: "database",
          collection: "inbox:notes",
          createdAtFrom: "2026-01-01",
          createdAtTo: "2026-12-31",
        }),
      },
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [
        expect.objectContaining({
          kind: "chunk",
          score: 0.96,
          indexing: expect.objectContaining({
            matchedLayer: "chunk",
            domain: "engineering",
          }),
          chunk: expect.objectContaining({
            id: "chunk-1",
            asset: expect.objectContaining({
              id: "asset-search-1",
              title: "Search result asset",
            }),
          }),
        }),
      ],
      evidence: {
        items: [
          expect.objectContaining({
            id: "chunk:chunk-1",
            layer: "chunk",
            score: 0.96,
            matchReasons: expect.arrayContaining([
              expect.objectContaining({
                code: "semantic_match",
              }),
            ]),
            asset: expect.objectContaining({
              id: "asset-search-1",
            }),
          }),
        ],
      },
      groupedEvidence: [
        {
          asset: expect.objectContaining({
            id: "asset-search-1",
          }),
          assetScore: 0.96,
          topScore: 0.96,
          matchedLayers: ["chunk"],
          groupSummary: expect.objectContaining({
            headline: expect.any(String),
            bullets: expect.any(Array),
          }),
          primaryEvidence: expect.objectContaining({
            id: "chunk:chunk-1",
            layer: "chunk",
          }),
          items: [
            expect.objectContaining({
              id: "chunk:chunk-1",
              layer: "chunk",
            }),
          ],
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    });
    expect(searchService.searchAssets).toHaveBeenCalledWith(env, {
      query: "cloudmind",
      page: 1,
      pageSize: 20,
      domain: "engineering",
      documentClass: "design_doc",
      sourceKind: "manual",
      sourceHost: "developers.cloudflare.com",
      topic: "cloudflare",
      tag: "database",
      collection: "inbox:notes",
      createdAtFrom: "2026-01-01T00:00:00.000Z",
      createdAtTo: "2026-12-31T23:59:59.999Z",
    });
  });

  it("POST /api/search returns 400 for invalid input", async () => {
    const app = createApp();

    const response = await app.request("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "   ",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: expect.objectContaining({
        code: "INVALID_INPUT",
        message: "Invalid request payload",
      }),
    });
    expect(searchService.searchAssets).not.toHaveBeenCalled();
  });
});
