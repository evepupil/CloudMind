import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppEnv } from "@/env";
import { registerChatRoutes } from "@/features/chat/server/routes";
import * as chatService from "@/features/chat/server/service";

vi.mock("@/features/chat/server/service", () => {
  return {
    askLibrary: vi.fn(),
  };
});

const createApp = () => {
  const app = new Hono<AppEnv>();

  registerChatRoutes(app);

  return app;
};

describe("chat routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/chat returns an answer with sources", async () => {
    const app = createApp();
    const env = { APP_NAME: "cloudmind-test" };

    vi.mocked(chatService.askLibrary).mockResolvedValue({
      answer: "CloudMind emphasizes source-aware answers [S1].",
      sources: [
        {
          sourceType: "chunk",
          assetId: "asset-1",
          chunkId: "chunk-1",
          title: "Asset 1",
          sourceUrl: "https://example.com/cloudmind",
          snippet: "Source snippet 1",
        },
      ],
      evidence: {
        items: [
          {
            id: "chunk:chunk-1",
            layer: "chunk",
            score: 0.96,
            text: "Source snippet 1 full body",
            snippet: "Source snippet 1",
            chunkId: "chunk-1",
            chunkIndex: 0,
            vectorId: "asset-1:0",
            source: {
              sourceUrl: "https://example.com/cloudmind",
              sourceKind: "manual",
              sourceHost: "example.com",
              capturedAt: "2026-03-20T00:00:00.000Z",
            },
            indexing: {
              matchedLayer: "chunk",
              domain: "engineering",
              documentClass: "design_doc",
              sourceHost: "example.com",
              collectionKey: "inbox:notes",
              aiVisibility: "allow",
              sourceKind: "manual",
              topics: ["cloudmind"],
              assertionKind: null,
            },
            visibility: {
              aiVisibility: "allow",
              sensitivity: "internal",
            },
            asset: {
              id: "asset-1",
              type: "note",
              title: "Asset 1",
              summary: "Summary 1",
              sourceUrl: "https://example.com/cloudmind",
              sourceKind: "manual",
              status: "ready",
              domain: "engineering",
              sensitivity: "internal",
              aiVisibility: "allow",
              retrievalPriority: 10,
              documentClass: "design_doc",
              sourceHost: "example.com",
              collectionKey: "inbox:notes",
              capturedAt: "2026-03-20T00:00:00.000Z",
              descriptorJson: null,
              createdAt: "2026-03-20T00:00:00.000Z",
              updatedAt: "2026-03-20T00:00:00.000Z",
            },
          },
        ],
      },
      groupedEvidence: [
        {
          asset: {
            id: "asset-1",
            type: "note",
            title: "Asset 1",
            summary: "Summary 1",
            sourceUrl: "https://example.com/cloudmind",
            sourceKind: "manual",
            status: "ready",
            domain: "engineering",
            sensitivity: "internal",
            aiVisibility: "allow",
            retrievalPriority: 10,
            documentClass: "design_doc",
            sourceHost: "example.com",
            collectionKey: "inbox:notes",
            capturedAt: "2026-03-20T00:00:00.000Z",
            descriptorJson: null,
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-20T00:00:00.000Z",
          },
          assetScore: 0.96,
          topScore: 0.96,
          matchedLayers: ["chunk"],
          primaryEvidence: {
            id: "chunk:chunk-1",
            layer: "chunk",
            score: 0.96,
            text: "Source snippet 1 full body",
            snippet: "Source snippet 1",
            chunkId: "chunk-1",
            chunkIndex: 0,
            vectorId: "asset-1:0",
            source: {
              sourceUrl: "https://example.com/cloudmind",
              sourceKind: "manual",
              sourceHost: "example.com",
              capturedAt: "2026-03-20T00:00:00.000Z",
            },
            indexing: {
              matchedLayer: "chunk",
              domain: "engineering",
              documentClass: "design_doc",
              sourceHost: "example.com",
              collectionKey: "inbox:notes",
              aiVisibility: "allow",
              sourceKind: "manual",
              topics: ["cloudmind"],
              assertionKind: null,
            },
            visibility: {
              aiVisibility: "allow",
              sensitivity: "internal",
            },
            asset: {
              id: "asset-1",
              type: "note",
              title: "Asset 1",
              summary: "Summary 1",
              sourceUrl: "https://example.com/cloudmind",
              sourceKind: "manual",
              status: "ready",
              domain: "engineering",
              sensitivity: "internal",
              aiVisibility: "allow",
              retrievalPriority: 10,
              documentClass: "design_doc",
              sourceHost: "example.com",
              collectionKey: "inbox:notes",
              capturedAt: "2026-03-20T00:00:00.000Z",
              descriptorJson: null,
              createdAt: "2026-03-20T00:00:00.000Z",
              updatedAt: "2026-03-20T00:00:00.000Z",
            },
          },
          items: [
            {
              id: "chunk:chunk-1",
              layer: "chunk",
              score: 0.96,
              text: "Source snippet 1 full body",
              snippet: "Source snippet 1",
              chunkId: "chunk-1",
              chunkIndex: 0,
              vectorId: "asset-1:0",
              source: {
                sourceUrl: "https://example.com/cloudmind",
                sourceKind: "manual",
                sourceHost: "example.com",
                capturedAt: "2026-03-20T00:00:00.000Z",
              },
              indexing: {
                matchedLayer: "chunk",
                domain: "engineering",
                documentClass: "design_doc",
                sourceHost: "example.com",
                collectionKey: "inbox:notes",
                aiVisibility: "allow",
                sourceKind: "manual",
                topics: ["cloudmind"],
                assertionKind: null,
              },
              visibility: {
                aiVisibility: "allow",
                sensitivity: "internal",
              },
              asset: {
                id: "asset-1",
                type: "note",
                title: "Asset 1",
                summary: "Summary 1",
                sourceUrl: "https://example.com/cloudmind",
                sourceKind: "manual",
                status: "ready",
                domain: "engineering",
                sensitivity: "internal",
                aiVisibility: "allow",
                retrievalPriority: 10,
                documentClass: "design_doc",
                sourceHost: "example.com",
                collectionKey: "inbox:notes",
                capturedAt: "2026-03-20T00:00:00.000Z",
                descriptorJson: null,
                createdAt: "2026-03-20T00:00:00.000Z",
                updatedAt: "2026-03-20T00:00:00.000Z",
              },
            },
          ],
        },
      ],
    });

    const response = await app.request(
      "/api/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: "What does CloudMind emphasize?",
          topK: 3,
        }),
      },
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      answer: "CloudMind emphasizes source-aware answers [S1].",
      sources: [
        {
          sourceType: "chunk",
          assetId: "asset-1",
          chunkId: "chunk-1",
          title: "Asset 1",
          sourceUrl: "https://example.com/cloudmind",
          snippet: "Source snippet 1",
        },
      ],
      evidence: {
        items: [
          expect.objectContaining({
            id: "chunk:chunk-1",
            layer: "chunk",
            asset: expect.objectContaining({
              id: "asset-1",
            }),
          }),
        ],
      },
      groupedEvidence: [
        {
          asset: expect.objectContaining({
            id: "asset-1",
          }),
          assetScore: 0.96,
          topScore: 0.96,
          matchedLayers: ["chunk"],
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
    });
    expect(chatService.askLibrary).toHaveBeenCalledWith(env, {
      question: "What does CloudMind emphasize?",
      topK: 3,
    });
  });

  it("POST /api/chat returns 400 for invalid input", async () => {
    const app = createApp();

    const response = await app.request("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: "   ",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: expect.objectContaining({
        code: "INVALID_INPUT",
        message: "Invalid request payload",
      }),
    });
    expect(chatService.askLibrary).not.toHaveBeenCalled();
  });
});
