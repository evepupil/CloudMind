import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetNotFoundError } from "@/core/assets/errors";
import type { AppEnv } from "@/env";
import type { AssetDetail } from "@/features/assets/model/types";
import * as assetService from "@/features/assets/server/service";
import type { AskLibraryResult } from "@/features/chat/model/types";
import * as chatService from "@/features/chat/server/service";
import * as ingestService from "@/features/ingest/server/service";
import { registerMcpRoutes } from "@/features/mcp/server/routes";
import type { SearchResult } from "@/features/search/model/types";
import * as searchService from "@/features/search/server/service";

vi.mock("@/features/assets/server/service", () => {
  return {
    getAssetById: vi.fn(),
  };
});

vi.mock("@/features/chat/server/service", () => {
  return {
    askLibrary: vi.fn(),
  };
});

vi.mock("@/features/ingest/server/service", () => {
  return {
    ingestTextAsset: vi.fn(),
    ingestUrlAsset: vi.fn(),
  };
});

vi.mock("@/features/search/server/service", () => {
  return {
    searchAssets: vi.fn(),
  };
});

const env = { APP_NAME: "cloudmind-test" };

const createAssetDetail = (
  overrides: Partial<AssetDetail> = {}
): AssetDetail => {
  return {
    id: "asset-1",
    type: "note",
    title: "MCP Asset",
    summary: "Generated summary",
    sourceUrl: null,
    sourceKind: "manual",
    status: "ready",
    domain: "general",
    sensitivity: "internal",
    aiVisibility: "allow",
    retrievalPriority: 0,
    collectionKey: "inbox:notes",
    capturedAt: "2026-03-20T00:00:00.000Z",
    descriptorJson: null,
    createdAt: "2026-03-20T00:00:00.000Z",
    updatedAt: "2026-03-20T00:02:00.000Z",
    contentText: "CloudMind asset body",
    rawR2Key: null,
    contentR2Key: null,
    mimeType: "text/plain",
    language: null,
    errorMessage: null,
    processedAt: "2026-03-20T00:02:00.000Z",
    failedAt: null,
    source: {
      kind: "manual",
      sourceUrl: null,
      metadataJson: null,
      createdAt: "2026-03-20T00:00:00.000Z",
    },
    jobs: [],
    chunks: [],
    ...overrides,
  };
};

const createSearchResult = (): SearchResult => {
  return {
    items: [
      {
        kind: "chunk",
        score: 0.91,
        chunk: {
          id: "chunk-1",
          chunkIndex: 0,
          textPreview: "CloudMind MCP search hit",
          contentText: "CloudMind MCP search hit full content",
          vectorId: "vector-1",
          asset: {
            id: "asset-1",
            type: "note",
            title: "MCP Search Asset",
            summary: "Summary",
            sourceUrl: null,
            sourceKind: "manual",
            status: "ready",
            domain: "general",
            sensitivity: "internal",
            aiVisibility: "allow",
            retrievalPriority: 0,
            collectionKey: "inbox:notes",
            capturedAt: "2026-03-20T00:00:00.000Z",
            descriptorJson: null,
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-20T00:01:00.000Z",
          },
        },
      },
    ],
    pagination: {
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    },
  };
};

const createAskLibraryResult = (): AskLibraryResult => {
  return {
    answer: "CloudMind exposes MCP tools for remote clients [S1].",
    sources: [
      {
        sourceType: "chunk",
        assetId: "asset-1",
        chunkId: "chunk-1",
        title: "MCP Search Asset",
        sourceUrl: null,
        snippet: "CloudMind MCP search hit",
      },
    ],
  };
};

const createApp = () => {
  const app = new Hono<AppEnv>();

  registerMcpRoutes(app);

  return app;
};

const createAppFetch = (app: Hono<AppEnv>) => {
  return (
    input: Parameters<typeof fetch>[0] | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const request =
      input instanceof Request
        ? new Request(input, init)
        : new Request(input.toString(), init);

    return Promise.resolve(app.fetch(request, env));
  };
};

const getStructuredContent = (
  result: Awaited<ReturnType<Client["callTool"]>>
): Record<string, unknown> => {
  if (!("structuredContent" in result)) {
    throw new Error("Expected MCP tool result to include structuredContent.");
  }

  if (
    !result.structuredContent ||
    typeof result.structuredContent !== "object" ||
    Array.isArray(result.structuredContent)
  ) {
    throw new Error("Expected MCP tool result to include structuredContent.");
  }

  return result.structuredContent as Record<string, unknown>;
};

const createConnectedClient = async (app: Hono<AppEnv>) => {
  const client = new Client({
    name: "cloudmind-test-client",
    version: "0.1.0",
  });
  const transport = new StreamableHTTPClientTransport(
    new URL("http://cloudmind.test/mcp"),
    {
      fetch: createAppFetch(app),
    }
  );

  await client.connect(transport as unknown as Transport);

  return {
    client,
    transport,
  };
};

describe("mcp routes", () => {
  let client: Client | null = null;
  let transport: StreamableHTTPClientTransport | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (transport) {
      await transport.close();
    }

    client = null;
    transport = null;
  });

  it("lists the four CloudMind MCP tools", async () => {
    const app = createApp();
    const connected = await createConnectedClient(app);

    client = connected.client;
    transport = connected.transport;

    const result = await client.listTools();

    expect(result.tools.map((tool) => tool.name)).toEqual([
      "save_asset",
      "search_assets",
      "get_asset",
      "ask_library",
    ]);
  });

  it("save_asset ingests text content through the existing ingest service", async () => {
    const app = createApp();
    const item = createAssetDetail();

    vi.mocked(ingestService.ingestTextAsset).mockResolvedValue(item);
    const connected = await createConnectedClient(app);

    client = connected.client;
    transport = connected.transport;

    const result = await client.callTool({
      name: "save_asset",
      arguments: {
        type: "text",
        title: "MCP note",
        content: "Saved from MCP",
      },
    });

    expect(getStructuredContent(result)).toEqual({ item });
    expect(ingestService.ingestTextAsset).toHaveBeenCalledWith(env, {
      title: "MCP note",
      content: "Saved from MCP",
      sourceKind: "mcp",
    });
  });

  it("save_asset ingests urls through the existing ingest service", async () => {
    const app = createApp();
    const item = createAssetDetail({
      id: "asset-url-1",
      type: "url",
      title: "Cloudflare Docs",
      sourceUrl: "https://developers.cloudflare.com",
    });

    vi.mocked(ingestService.ingestUrlAsset).mockResolvedValue(item);
    const connected = await createConnectedClient(app);

    client = connected.client;
    transport = connected.transport;

    const result = await client.callTool({
      name: "save_asset",
      arguments: {
        type: "url",
        title: "Cloudflare Docs",
        url: "https://developers.cloudflare.com",
      },
    });

    expect(getStructuredContent(result)).toEqual({ item });
    expect(ingestService.ingestUrlAsset).toHaveBeenCalledWith(env, {
      title: "Cloudflare Docs",
      url: "https://developers.cloudflare.com",
      sourceKind: "mcp",
    });
  });

  it("search_assets, get_asset and ask_library reuse the existing services", async () => {
    const app = createApp();
    const searchResult = createSearchResult();
    const item = createAssetDetail({
      id: "asset-detail-1",
      title: "MCP Detail Asset",
    });
    const askResult = createAskLibraryResult();

    vi.mocked(searchService.searchAssets).mockResolvedValue(searchResult);
    vi.mocked(assetService.getAssetById).mockResolvedValue(item);
    vi.mocked(chatService.askLibrary).mockResolvedValue(askResult);
    const connected = await createConnectedClient(app);

    client = connected.client;
    transport = connected.transport;

    const searchCall = await client.callTool({
      name: "search_assets",
      arguments: {
        query: "cloudmind mcp",
        page: 1,
        pageSize: 10,
      },
    });
    const getAssetCall = await client.callTool({
      name: "get_asset",
      arguments: {
        id: "asset-detail-1",
      },
    });
    const askCall = await client.callTool({
      name: "ask_library",
      arguments: {
        question: "How does CloudMind expose MCP?",
        topK: 4,
      },
    });

    expect(getStructuredContent(searchCall)).toEqual(searchResult);
    expect(getStructuredContent(getAssetCall)).toEqual({ item });
    expect(getStructuredContent(askCall)).toEqual(askResult);
    expect(searchService.searchAssets).toHaveBeenCalledWith(env, {
      query: "cloudmind mcp",
      page: 1,
      pageSize: 10,
    });
    expect(assetService.getAssetById).toHaveBeenCalledWith(
      env,
      "asset-detail-1"
    );
    expect(chatService.askLibrary).toHaveBeenCalledWith(env, {
      question: "How does CloudMind expose MCP?",
      topK: 4,
    });
  });

  it("get_asset returns an MCP tool error payload when the asset is missing", async () => {
    const app = createApp();

    vi.mocked(assetService.getAssetById).mockRejectedValue(
      new AssetNotFoundError("missing-asset")
    );
    const connected = await createConnectedClient(app);

    client = connected.client;
    transport = connected.transport;

    const result = await client.callTool({
      name: "get_asset",
      arguments: {
        id: "missing-asset",
      },
    });

    expect("isError" in result ? result.isError : false).toBe(true);
    expect(getStructuredContent(result)).toEqual({
      ok: false,
      error: {
        code: "ASSET_NOT_FOUND",
        message: 'Asset "missing-asset" was not found.',
      },
    });
  });

  it("GET and DELETE /mcp are rejected in stateless mode", async () => {
    const app = createApp();

    const getResponse = await app.request("/mcp", undefined, env);
    const deleteResponse = await app.request(
      "/mcp",
      {
        method: "DELETE",
      },
      env
    );

    expect(getResponse.status).toBe(405);
    await expect(getResponse.json()).resolves.toEqual({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    });
    expect(deleteResponse.status).toBe(405);
    await expect(deleteResponse.json()).resolves.toEqual({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    });
  });
});
