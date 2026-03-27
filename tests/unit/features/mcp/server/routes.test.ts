import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetNotFoundError } from "@/core/assets/errors";
import { WorkflowRunNotFoundError } from "@/core/workflows/errors";
import type { AppEnv } from "@/env";
import type { AssetDetail } from "@/features/assets/model/types";
import * as assetService from "@/features/assets/server/service";
import type { AskLibraryResult } from "@/features/chat/model/types";
import * as chatService from "@/features/chat/server/service";
import * as ingestService from "@/features/ingest/server/service";
import { registerMcpRoutes } from "@/features/mcp/server/routes";
import type { SearchResult } from "@/features/search/model/types";
import * as searchService from "@/features/search/server/service";
import * as termAssetService from "@/features/search/server/term-asset-service";
import * as termSearchService from "@/features/search/server/term-service";
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

vi.mock("@/features/chat/server/service", () => {
  return {
    askLibrary: vi.fn(),
    askLibraryForContext: vi.fn(),
  };
});

vi.mock("@/features/ingest/server/service", () => {
  return {
    ingestTextAsset: vi.fn(),
    reprocessAsset: vi.fn(),
    ingestUrlAsset: vi.fn(),
  };
});

vi.mock("@/features/search/server/service", () => {
  return {
    searchAssets: vi.fn(),
    searchAssetsForContext: vi.fn(),
  };
});

vi.mock("@/features/search/server/term-service", () => {
  return {
    searchTerms: vi.fn(),
  };
});

vi.mock("@/features/search/server/term-asset-service", () => {
  return {
    searchAssetsByTerms: vi.fn(),
  };
});

vi.mock("@/features/workflows/server/service", () => {
  return {
    getWorkflowRunDetail: vi.fn(),
    listWorkflowRunsByAssetId: vi.fn(),
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

const createTermSearchResult = () => {
  return {
    items: [
      {
        kind: "topic" as const,
        term: "cloudmind",
        normalized: "cloudmind",
        score: 0.93,
      },
      {
        kind: "collection" as const,
        term: "journal/2026/03",
        normalized: "journal/2026/03",
        score: 0.87,
      },
    ],
  };
};

const createSearchResult = (): SearchResult => {
  return {
    items: [
      {
        kind: "chunk",
        score: 0.91,
        indexing: {
          matchedLayer: "chunk",
          domain: "general",
          documentClass: "general_note",
          sourceHost: null,
          collectionKey: "inbox:notes",
          aiVisibility: "allow",
          sourceKind: "manual",
          topics: ["mcp"],
          assertionKind: null,
        },
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
    evidence: {
      items: [
        {
          id: "chunk:chunk-1",
          layer: "chunk",
          score: 0.91,
          text: "CloudMind MCP search hit full content",
          snippet: "CloudMind MCP search hit",
          chunkId: "chunk-1",
          chunkIndex: 0,
          vectorId: "vector-1",
          source: {
            sourceUrl: null,
            sourceKind: "manual",
            sourceHost: null,
            capturedAt: "2026-03-20T00:00:00.000Z",
          },
          indexing: {
            matchedLayer: "chunk",
            domain: "general",
            documentClass: "general_note",
            sourceHost: null,
            collectionKey: "inbox:notes",
            aiVisibility: "allow",
            sourceKind: "manual",
            topics: ["mcp"],
            assertionKind: null,
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
      ],
    },
    groupedEvidence: [
      {
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
        assetScore: 0.91,
        topScore: 0.91,
        matchedLayers: ["chunk"],
        groupSummary: {
          headline: "Semantic match led this asset",
          bullets: ["Primary signal: Semantic match."],
        },
        primaryEvidence: {
          id: "chunk:chunk-1",
          layer: "chunk",
          score: 0.91,
          text: "CloudMind MCP search hit full content",
          snippet: "CloudMind MCP search hit",
          chunkId: "chunk-1",
          chunkIndex: 0,
          vectorId: "vector-1",
          source: {
            sourceUrl: null,
            sourceKind: "manual",
            sourceHost: null,
            capturedAt: "2026-03-20T00:00:00.000Z",
          },
          indexing: {
            matchedLayer: "chunk",
            domain: "general",
            documentClass: "general_note",
            sourceHost: null,
            collectionKey: "inbox:notes",
            aiVisibility: "allow",
            sourceKind: "manual",
            topics: ["mcp"],
            assertionKind: null,
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
        items: [
          {
            id: "chunk:chunk-1",
            layer: "chunk",
            score: 0.91,
            text: "CloudMind MCP search hit full content",
            snippet: "CloudMind MCP search hit",
            chunkId: "chunk-1",
            chunkIndex: 0,
            vectorId: "vector-1",
            source: {
              sourceUrl: null,
              sourceKind: "manual",
              sourceHost: null,
              capturedAt: "2026-03-20T00:00:00.000Z",
            },
            indexing: {
              matchedLayer: "chunk",
              domain: "general",
              documentClass: "general_note",
              sourceHost: null,
              collectionKey: "inbox:notes",
              aiVisibility: "allow",
              sourceKind: "manual",
              topics: ["mcp"],
              assertionKind: null,
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
        ],
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
    evidence: {
      items: [
        {
          id: "chunk:chunk-1",
          layer: "chunk",
          score: 0.91,
          text: "CloudMind MCP search hit full content",
          snippet: "CloudMind MCP search hit",
          chunkId: "chunk-1",
          chunkIndex: 0,
          vectorId: "vector-1",
          source: {
            sourceUrl: null,
            sourceKind: "manual",
            sourceHost: "developers.cloudflare.com",
            capturedAt: "2026-03-20T00:00:00.000Z",
          },
          indexing: {
            matchedLayer: "chunk",
            domain: "engineering",
            documentClass: "design_doc",
            sourceHost: "developers.cloudflare.com",
            collectionKey: "site:developers.cloudflare.com",
            aiVisibility: "allow",
            sourceKind: "manual",
            topics: ["mcp", "cloudflare"],
            assertionKind: null,
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
          asset: {
            id: "asset-1",
            type: "note",
            title: "MCP Search Asset",
            summary: "Summary",
            sourceUrl: null,
            sourceKind: "manual",
            status: "ready",
            domain: "engineering",
            sensitivity: "internal",
            aiVisibility: "allow",
            retrievalPriority: 0,
            documentClass: "design_doc",
            sourceHost: "developers.cloudflare.com",
            collectionKey: "site:developers.cloudflare.com",
            capturedAt: "2026-03-20T00:00:00.000Z",
            descriptorJson: null,
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-20T00:01:00.000Z",
          },
        },
      ],
    },
    groupedEvidence: [
      {
        asset: {
          id: "asset-1",
          type: "note",
          title: "MCP Search Asset",
          summary: "Summary",
          sourceUrl: null,
          sourceKind: "manual",
          status: "ready",
          domain: "engineering",
          sensitivity: "internal",
          aiVisibility: "allow",
          retrievalPriority: 0,
          documentClass: "design_doc",
          sourceHost: "developers.cloudflare.com",
          collectionKey: "site:developers.cloudflare.com",
          capturedAt: "2026-03-20T00:00:00.000Z",
          descriptorJson: null,
          createdAt: "2026-03-20T00:00:00.000Z",
          updatedAt: "2026-03-20T00:01:00.000Z",
        },
        assetScore: 0.91,
        topScore: 0.91,
        matchedLayers: ["chunk"],
        groupSummary: {
          headline: "Semantic match led this asset",
          bullets: ["Primary signal: Semantic match."],
        },
        primaryEvidence: {
          id: "chunk:chunk-1",
          layer: "chunk",
          score: 0.91,
          text: "CloudMind MCP search hit full content",
          snippet: "CloudMind MCP search hit",
          chunkId: "chunk-1",
          chunkIndex: 0,
          vectorId: "vector-1",
          source: {
            sourceUrl: null,
            sourceKind: "manual",
            sourceHost: "developers.cloudflare.com",
            capturedAt: "2026-03-20T00:00:00.000Z",
          },
          indexing: {
            matchedLayer: "chunk",
            domain: "engineering",
            documentClass: "design_doc",
            sourceHost: "developers.cloudflare.com",
            collectionKey: "site:developers.cloudflare.com",
            aiVisibility: "allow",
            sourceKind: "manual",
            topics: ["mcp", "cloudflare"],
            assertionKind: null,
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
          asset: {
            id: "asset-1",
            type: "note",
            title: "MCP Search Asset",
            summary: "Summary",
            sourceUrl: null,
            sourceKind: "manual",
            status: "ready",
            domain: "engineering",
            sensitivity: "internal",
            aiVisibility: "allow",
            retrievalPriority: 0,
            documentClass: "design_doc",
            sourceHost: "developers.cloudflare.com",
            collectionKey: "site:developers.cloudflare.com",
            capturedAt: "2026-03-20T00:00:00.000Z",
            descriptorJson: null,
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-20T00:01:00.000Z",
          },
        },
        items: [
          {
            id: "chunk:chunk-1",
            layer: "chunk",
            score: 0.91,
            text: "CloudMind MCP search hit full content",
            snippet: "CloudMind MCP search hit",
            chunkId: "chunk-1",
            chunkIndex: 0,
            vectorId: "vector-1",
            source: {
              sourceUrl: null,
              sourceKind: "manual",
              sourceHost: "developers.cloudflare.com",
              capturedAt: "2026-03-20T00:00:00.000Z",
            },
            indexing: {
              matchedLayer: "chunk",
              domain: "engineering",
              documentClass: "design_doc",
              sourceHost: "developers.cloudflare.com",
              collectionKey: "site:developers.cloudflare.com",
              aiVisibility: "allow",
              sourceKind: "manual",
              topics: ["mcp", "cloudflare"],
              assertionKind: null,
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
            asset: {
              id: "asset-1",
              type: "note",
              title: "MCP Search Asset",
              summary: "Summary",
              sourceUrl: null,
              sourceKind: "manual",
              status: "ready",
              domain: "engineering",
              sensitivity: "internal",
              aiVisibility: "allow",
              retrievalPriority: 0,
              documentClass: "design_doc",
              sourceHost: "developers.cloudflare.com",
              collectionKey: "site:developers.cloudflare.com",
              capturedAt: "2026-03-20T00:00:00.000Z",
              descriptorJson: null,
              createdAt: "2026-03-20T00:00:00.000Z",
              updatedAt: "2026-03-20T00:01:00.000Z",
            },
          },
        ],
      },
    ],
    indexingSummary: {
      matchedLayers: ["chunk"],
      domains: ["engineering"],
      documentClasses: ["design_doc"],
      sourceKinds: ["manual"],
      sourceHosts: ["developers.cloudflare.com"],
      collections: ["site:developers.cloudflare.com"],
      topics: ["mcp", "cloudflare"],
    },
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

  it("lists the CloudMind MCP tools", async () => {
    const app = createApp();
    const connected = await createConnectedClient(app);

    client = connected.client;
    transport = connected.transport;

    const result = await client.listTools();

    expect(result.tools.map((tool) => tool.name)).toEqual([
      "save_asset",
      "list_assets",
      "search_terms",
      "search_assets_by_terms",
      "search_assets",
      "search_assets_for_context",
      "get_asset",
      "update_asset",
      "delete_asset",
      "restore_asset",
      "reprocess_asset",
      "list_asset_workflows",
      "get_workflow_run",
      "ask_library",
      "ask_library_for_context",
    ]);

    const toolsByName = Object.fromEntries(
      result.tools.map((tool) => [tool.name, tool])
    );

    expect(toolsByName.search_terms?.description).toContain(
      "metadata term pool"
    );
    expect(toolsByName.search_assets_by_terms?.description).toContain(
      "metadata-driven asset discovery"
    );
    expect(toolsByName.search_assets?.description).toContain(
      "groupedEvidence as the primary view"
    );
    expect(toolsByName.search_assets_for_context?.description).toContain(
      "retrieval-first workflows"
    );
    expect(toolsByName.get_asset?.description).toContain(
      "after search_assets*"
    );
    expect(toolsByName.ask_library?.description).toContain(
      "convenience summary tool"
    );
    expect(toolsByName.ask_library_for_context?.description).toContain(
      "Prefer search_assets* plus get_asset"
    );
  });

  it("search_terms reuses the term search service", async () => {
    const app = createApp();
    const result = createTermSearchResult();

    vi.mocked(termSearchService.searchTerms).mockResolvedValue(result);
    const connected = await createConnectedClient(app);

    client = connected.client;
    transport = connected.transport;

    const call = await client.callTool({
      name: "search_terms",
      arguments: {
        query: "cloudmind deploy",
        kinds: ["topic", "collection"],
        topK: 5,
      },
    });

    expect(getStructuredContent(call)).toEqual(result);
    expect(termSearchService.searchTerms).toHaveBeenCalledWith(env, {
      query: "cloudmind deploy",
      kinds: ["topic", "collection"],
      topK: 5,
    });
  });

  it("search_assets_by_terms reuses the existing term asset service", async () => {
    const app = createApp();
    const result = {
      terms: createTermSearchResult().items,
      items: [
        {
          asset: createAssetDetail({
            id: "asset-terms-1",
            title: "CloudMind roadmap",
            aiVisibility: "summary_only",
          }),
          matchedTerms: [
            {
              facetKey: "topic" as const,
              facetValue: "cloudmind",
            },
          ],
        },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
    };

    vi.mocked(termAssetService.searchAssetsByTerms).mockResolvedValue(result);
    const connected = await createConnectedClient(app);

    client = connected.client;
    transport = connected.transport;

    const call = await client.callTool({
      name: "search_assets_by_terms",
      arguments: {
        query: "cloudmind roadmap",
        kinds: ["topic"],
        topK: 5,
        page: 1,
        pageSize: 10,
      },
    });

    expect(getStructuredContent(call)).toEqual(result);
    expect(termAssetService.searchAssetsByTerms).toHaveBeenCalledWith(env, {
      query: "cloudmind roadmap",
      kinds: ["topic"],
      topK: 5,
      page: 1,
      pageSize: 10,
    });
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

  it("save_asset forwards optional text enrichment with enum-backed fields", async () => {
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
        title: "MCP enriched note",
        content: "Saved from MCP with enrichment",
        enrichment: {
          summary: "Client summary",
          domain: "engineering",
          documentClass: "design_doc",
          descriptor: {
            topics: ["mcp", "workflow"],
            collectionKey: "project/cloudmind",
            signals: ["seeded_by_client"],
          },
          facets: [
            {
              facetKey: "topic",
              facetValue: "mcp",
              facetLabel: "mcp",
            },
          ],
        },
      },
    });

    expect(getStructuredContent(result)).toEqual({ item });
    expect(ingestService.ingestTextAsset).toHaveBeenCalledWith(env, {
      title: "MCP enriched note",
      content: "Saved from MCP with enrichment",
      sourceKind: "mcp",
      enrichment: {
        summary: "Client summary",
        domain: "engineering",
        documentClass: "design_doc",
        descriptor: {
          topics: ["mcp", "workflow"],
          collectionKey: "project/cloudmind",
          signals: ["seeded_by_client"],
        },
        facets: [
          {
            facetKey: "topic",
            facetValue: "mcp",
            facetLabel: "mcp",
          },
        ],
      },
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

  it("search_assets_for_context and ask_library_for_context apply the requested profile", async () => {
    const app = createApp();
    const searchResult = {
      ...createSearchResult(),
      resultScope: "preferred_only" as const,
    };
    const askResult = {
      ...createAskLibraryResult(),
      resultScope: "preferred_only" as const,
    };

    vi.mocked(searchService.searchAssetsForContext).mockResolvedValue(
      searchResult
    );
    vi.mocked(chatService.askLibraryForContext).mockResolvedValue(askResult);
    const connected = await createConnectedClient(app);

    client = connected.client;
    transport = connected.transport;

    const searchCall = await client.callTool({
      name: "search_assets_for_context",
      arguments: {
        query: "fix vector write bug",
        page: 1,
        pageSize: 5,
        profile: "coding",
        allowFallback: false,
      },
    });
    const askCall = await client.callTool({
      name: "ask_library_for_context",
      arguments: {
        question: "How should I debug the vector write bug?",
        topK: 3,
        profile: "coding",
        allowFallback: false,
      },
    });

    expect(getStructuredContent(searchCall)).toEqual({
      ...searchResult,
      appliedPolicy: {
        profile: "coding",
        preferredDomains: ["engineering", "research"],
        boostedDomains: ["engineering", "research"],
        suppressedDomains: ["personal", "finance", "health"],
        includeSummaryOnly: true,
        allowFallback: false,
      },
    });
    expect(getStructuredContent(askCall)).toEqual({
      ...askResult,
      appliedPolicy: {
        profile: "coding",
        preferredDomains: ["engineering", "research"],
        boostedDomains: ["engineering", "research"],
        suppressedDomains: ["personal", "finance", "health"],
        includeSummaryOnly: true,
        allowFallback: false,
      },
    });
    expect(searchService.searchAssetsForContext).toHaveBeenCalledWith(
      env,
      {
        query: "fix vector write bug",
        page: 1,
        pageSize: 5,
        profile: "coding",
        allowFallback: false,
      },
      {
        profile: "coding",
        preferredDomains: ["engineering", "research"],
        boostedDomains: ["engineering", "research"],
        suppressedDomains: ["personal", "finance", "health"],
        includeSummaryOnly: true,
        overfetchMultiplier: 3,
        allowFallback: false,
      }
    );
    expect(chatService.askLibraryForContext).toHaveBeenCalledWith(
      env,
      {
        question: "How should I debug the vector write bug?",
        topK: 3,
        profile: "coding",
        allowFallback: false,
      },
      {
        profile: "coding",
        preferredDomains: ["engineering", "research"],
        boostedDomains: ["engineering", "research"],
        suppressedDomains: ["personal", "finance", "health"],
        includeSummaryOnly: true,
        overfetchMultiplier: 3,
        allowFallback: false,
      }
    );
  });

  it("list_assets, update_asset, delete_asset, restore_asset, reprocess_asset and workflow tools reuse existing services", async () => {
    const app = createApp();
    const item = createAssetDetail({
      id: "asset-manage-1",
      title: "Managed Asset",
    });
    const workflowRun = {
      id: "run-1",
      assetId: "asset-manage-1",
      workflowType: "note_ingest_v1" as const,
      triggerType: "ingest" as const,
      status: "succeeded" as const,
      stateJson: "{}",
      currentStep: null,
      errorMessage: null,
      startedAt: "2026-03-20T00:01:00.000Z",
      finishedAt: "2026-03-20T00:02:00.000Z",
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:02:00.000Z",
    };
    const workflowDetail = {
      run: workflowRun,
      steps: [],
      artifacts: [],
    };

    vi.mocked(assetService.listAssets).mockResolvedValue({
      items: [item],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
    });
    vi.mocked(assetService.updateAsset).mockResolvedValue({
      ...item,
      title: "Updated Managed Asset",
      summary: "Updated summary",
    });
    vi.mocked(assetService.deleteAsset).mockResolvedValue(undefined);
    vi.mocked(assetService.restoreAsset).mockResolvedValue({
      ...item,
      title: "Restored Asset",
    });
    vi.mocked(ingestService.reprocessAsset).mockResolvedValue({
      ...item,
      status: "processing",
    });
    vi.mocked(assetService.getAssetById).mockResolvedValue(item);
    vi.mocked(workflowService.listWorkflowRunsByAssetId).mockResolvedValue([
      workflowRun,
    ]);
    vi.mocked(workflowService.getWorkflowRunDetail).mockResolvedValue(
      workflowDetail
    );
    const connected = await createConnectedClient(app);

    client = connected.client;
    transport = connected.transport;

    const listCall = await client.callTool({
      name: "list_assets",
      arguments: {
        status: "ready",
        domain: "engineering",
        documentClass: "design_doc",
        sourceKind: "manual",
        deleted: "only",
        aiVisibility: "allow",
        sourceHost: "developers.cloudflare.com",
        topic: "cloudmind",
        tag: "mvp",
        collection: "journal/2026/03",
        page: 1,
        pageSize: 10,
      },
    });
    const updateCall = await client.callTool({
      name: "update_asset",
      arguments: {
        id: "asset-manage-1",
        title: "Updated Managed Asset",
        summary: "Updated summary",
      },
    });
    const deleteCall = await client.callTool({
      name: "delete_asset",
      arguments: {
        id: "asset-manage-1",
      },
    });
    const restoreCall = await client.callTool({
      name: "restore_asset",
      arguments: {
        id: "asset-manage-1",
      },
    });
    const reprocessCall = await client.callTool({
      name: "reprocess_asset",
      arguments: {
        id: "asset-manage-1",
      },
    });
    const listWorkflowsCall = await client.callTool({
      name: "list_asset_workflows",
      arguments: {
        assetId: "asset-manage-1",
      },
    });
    const getWorkflowCall = await client.callTool({
      name: "get_workflow_run",
      arguments: {
        runId: "run-1",
      },
    });

    expect(getStructuredContent(listCall)).toEqual({
      items: [item],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
    });
    expect(getStructuredContent(updateCall)).toEqual({
      item: expect.objectContaining({
        id: "asset-manage-1",
        title: "Updated Managed Asset",
      }),
    });
    expect(getStructuredContent(deleteCall)).toEqual({
      ok: true,
      id: "asset-manage-1",
    });
    expect(getStructuredContent(restoreCall)).toEqual({
      item: expect.objectContaining({
        id: "asset-manage-1",
        title: "Restored Asset",
      }),
    });
    expect(getStructuredContent(reprocessCall)).toEqual({
      item: expect.objectContaining({
        id: "asset-manage-1",
        status: "processing",
      }),
    });
    expect(getStructuredContent(listWorkflowsCall)).toEqual({
      items: [workflowRun],
    });
    expect(getStructuredContent(getWorkflowCall)).toEqual({
      item: workflowDetail,
    });
    expect(assetService.listAssets).toHaveBeenCalledWith(env, {
      status: "ready",
      domain: "engineering",
      documentClass: "design_doc",
      sourceKind: "manual",
      deleted: "only",
      aiVisibility: "allow",
      sourceHost: "developers.cloudflare.com",
      topic: "cloudmind",
      tag: "mvp",
      collection: "journal/2026/03",
      page: 1,
      pageSize: 10,
    });
    expect(assetService.updateAsset).toHaveBeenCalledWith(
      env,
      "asset-manage-1",
      {
        title: "Updated Managed Asset",
        summary: "Updated summary",
        sourceUrl: undefined,
      }
    );
    expect(assetService.deleteAsset).toHaveBeenCalledWith(
      env,
      "asset-manage-1"
    );
    expect(assetService.restoreAsset).toHaveBeenCalledWith(
      env,
      "asset-manage-1"
    );
    expect(ingestService.reprocessAsset).toHaveBeenCalledWith(
      env,
      "asset-manage-1"
    );
    expect(assetService.getAssetById).toHaveBeenCalledWith(
      env,
      "asset-manage-1"
    );
    expect(workflowService.listWorkflowRunsByAssetId).toHaveBeenCalledWith(
      env,
      "asset-manage-1"
    );
    expect(workflowService.getWorkflowRunDetail).toHaveBeenCalledWith(
      env,
      "run-1"
    );
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

  it("get_workflow_run returns an MCP tool error payload when the run is missing", async () => {
    const app = createApp();

    vi.mocked(workflowService.getWorkflowRunDetail).mockRejectedValue(
      new WorkflowRunNotFoundError("missing-run")
    );
    const connected = await createConnectedClient(app);

    client = connected.client;
    transport = connected.transport;

    const result = await client.callTool({
      name: "get_workflow_run",
      arguments: {
        runId: "missing-run",
      },
    });

    expect("isError" in result ? result.isError : false).toBe(true);
    expect(getStructuredContent(result)).toEqual({
      ok: false,
      error: {
        code: "WORKFLOW_RUN_NOT_FOUND",
        message: 'Workflow run "missing-run" was not found.',
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
