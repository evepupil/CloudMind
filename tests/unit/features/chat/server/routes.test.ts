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
          assetId: "asset-1",
          chunkId: "chunk-1",
          title: "Asset 1",
          sourceUrl: "https://example.com/cloudmind",
          snippet: "Source snippet 1",
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
          assetId: "asset-1",
          chunkId: "chunk-1",
          title: "Asset 1",
          sourceUrl: "https://example.com/cloudmind",
          snippet: "Source snippet 1",
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
