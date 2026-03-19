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

  it("POST /api/search returns keyword search results", async () => {
    const app = createApp();
    const env = { APP_NAME: "cloudmind-test" };

    vi.mocked(searchService.searchAssets).mockResolvedValue({
      items: [
        {
          id: "asset-search-1",
          type: "note",
          title: "Search result asset",
          summary: "Search summary",
          sourceUrl: null,
          status: "ready",
          createdAt: "2026-03-19T00:00:00.000Z",
          updatedAt: "2026-03-19T00:00:00.000Z",
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
        }),
      },
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
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
    expect(searchService.searchAssets).toHaveBeenCalledWith(env, {
      query: "cloudmind",
      page: 1,
      pageSize: 20,
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
