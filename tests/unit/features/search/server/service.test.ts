import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AIProvider } from "@/core/ai/ports";
import type {
  AssetSearchInput,
  AssetSearchRepository,
} from "@/core/assets/ports";
import type {
  VectorSearchInput,
  VectorSearchMatch,
  VectorStore,
} from "@/core/vector/ports";
import type {
  AssetAiVisibility,
  AssetChunkMatch,
  AssetListResult,
  AssetSummaryMatch,
} from "@/features/assets/model/types";
import { createSearchService } from "@/features/search/server/service";

class InMemorySearchRepository implements AssetSearchRepository {
  public readonly chunkMatchQueries: Array<AssetAiVisibility[] | undefined> =
    [];

  public readonly summaryQueries: Array<{
    query: string;
    limit: number;
    aiVisibility: AssetAiVisibility[];
  }> = [];

  public async searchAssets(
    _input: AssetSearchInput
  ): Promise<AssetListResult> {
    return {
      items: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      },
    };
  }

  public async getChunkMatchesByVectorIds(
    vectorIds: string[],
    query?: {
      aiVisibility?: AssetAiVisibility[] | undefined;
    }
  ): Promise<AssetChunkMatch[]> {
    this.chunkMatchQueries.push(query?.aiVisibility);

    return vectorIds
      .map((vectorId, index) => ({
        id: `chunk-${index + 1}`,
        chunkIndex: index,
        textPreview: `Semantic preview ${index + 1}`,
        vectorId,
        asset: {
          id: `asset-${index + 1}`,
          type: "note" as const,
          title: `CloudMind Asset ${index + 1}`,
          summary: `Asset summary ${index + 1}`,
          sourceUrl: null,
          sourceKind: "manual" as const,
          status: "ready" as const,
          domain: "engineering" as const,
          sensitivity: "internal" as const,
          aiVisibility:
            index === 1 ? ("summary_only" as const) : ("allow" as const),
          retrievalPriority: 10,
          collectionKey: "inbox:notes",
          capturedAt: "2026-03-19T00:00:00.000Z",
          descriptorJson: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          updatedAt: "2026-03-19T00:00:00.000Z",
        },
      }))
      .filter((chunkMatch) => {
        const allowed = query?.aiVisibility;

        if (!allowed?.length) {
          return true;
        }

        return allowed.includes(chunkMatch.asset.aiVisibility);
      });
  }

  public async searchAssetSummaries(input: {
    query: string;
    limit: number;
    aiVisibility: AssetAiVisibility[];
  }): Promise<AssetSummaryMatch[]> {
    this.summaryQueries.push(input);

    return [
      {
        asset: {
          id: "asset-summary-1",
          type: "note",
          title: "CloudMind Summary Asset",
          summary: "Summary-only retrieval result",
          sourceUrl: null,
          sourceKind: "manual",
          status: "ready",
          domain: "product",
          sensitivity: "private",
          aiVisibility: "summary_only",
          retrievalPriority: 25,
          collectionKey: "inbox:notes",
          capturedAt: "2026-03-19T00:00:00.000Z",
          descriptorJson: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          updatedAt: "2026-03-19T00:00:00.000Z",
        },
        summary: "Summary-only retrieval result",
      },
    ];
  }
}

class InMemoryVectorStore implements VectorStore {
  public async upsert(): Promise<void> {
    return undefined;
  }

  public async search(input: VectorSearchInput): Promise<VectorSearchMatch[]> {
    return Array.from({ length: input.topK }, (_, index) => ({
      id: `asset-${index + 1}:${index}`,
      score: 0.95 - index * 0.05,
    }));
  }

  public async deleteByIds(): Promise<void> {
    return undefined;
  }
}

class FixedVectorStore implements VectorStore {
  public constructor(private readonly matches: VectorSearchMatch[]) {}

  public async upsert(): Promise<void> {
    return undefined;
  }

  public async search(): Promise<VectorSearchMatch[]> {
    return this.matches;
  }

  public async deleteByIds(): Promise<void> {
    return undefined;
  }
}

class MixedDomainSearchRepository implements AssetSearchRepository {
  public async searchAssets(
    _input: AssetSearchInput
  ): Promise<AssetListResult> {
    return {
      items: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      },
    };
  }

  public async getChunkMatchesByVectorIds(
    _vectorIds: string[],
    _query?: {
      aiVisibility?: AssetAiVisibility[] | undefined;
    }
  ): Promise<AssetChunkMatch[]> {
    return [
      {
        id: "chunk-personal-1",
        chunkIndex: 0,
        textPreview: "Personal note preview",
        contentText: "Personal note full content",
        vectorId: "personal-1:0",
        asset: {
          id: "asset-personal-1",
          type: "note",
          title: "Personal Debug Note",
          summary: "A personal note about a bug",
          sourceUrl: null,
          sourceKind: "manual",
          status: "ready",
          domain: "personal",
          sensitivity: "private",
          aiVisibility: "allow",
          retrievalPriority: 0,
          collectionKey: "inbox:notes",
          capturedAt: "2026-03-19T00:00:00.000Z",
          descriptorJson: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          updatedAt: "2026-03-19T00:00:00.000Z",
        },
      },
      {
        id: "chunk-engineering-1",
        chunkIndex: 1,
        textPreview: "Engineering design note",
        contentText: "Engineering design full content",
        vectorId: "engineering-1:0",
        asset: {
          id: "asset-engineering-1",
          type: "note",
          title: "Engineering Design Note",
          summary: "A design note for system work",
          sourceUrl: null,
          sourceKind: "manual",
          status: "ready",
          domain: "engineering",
          sensitivity: "internal",
          aiVisibility: "allow",
          retrievalPriority: 0,
          collectionKey: "inbox:notes",
          capturedAt: "2026-03-19T00:00:00.000Z",
          descriptorJson: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          updatedAt: "2026-03-19T00:00:00.000Z",
        },
      },
    ];
  }

  public async searchAssetSummaries(_input: {
    query: string;
    limit: number;
    aiVisibility: AssetAiVisibility[];
  }): Promise<AssetSummaryMatch[]> {
    return [];
  }
}

const embeddingProvider: AIProvider = {
  generateText: vi.fn(async () => ({
    text: "",
  })),
  createEmbeddings: vi.fn(async () => ({
    embeddings: [[0.11, 0.22, 0.33]],
  })),
};

describe("search service", () => {
  const getAssetRepositoryMock = vi.fn();
  const getVectorStoreMock = vi.fn();
  const getAIProviderMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searchAssets performs semantic retrieval and preserves match order", async () => {
    const repository = new InMemorySearchRepository();
    const vectorStore = new InMemoryVectorStore();
    const getChunkMatchesSpy = vi.spyOn(
      repository,
      "getChunkMatchesByVectorIds"
    );
    const vectorSearchSpy = vi.spyOn(vectorStore, "search");
    const service = createSearchService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStore),
      getAIProvider: getAIProviderMock.mockResolvedValue(embeddingProvider),
    });

    const result = await service.searchAssets(
      { APP_NAME: "cloudmind-test" },
      {
        query: "vector search",
        page: 1,
        pageSize: 2,
      }
    );

    expect(vectorSearchSpy).toHaveBeenCalledWith({
      values: [0.11, 0.22, 0.33],
      topK: 2,
    });
    expect(repository.summaryQueries).toEqual([
      {
        query: "vector search",
        limit: 2,
        aiVisibility: ["summary_only"],
      },
    ]);
    expect(getChunkMatchesSpy).toHaveBeenCalledWith(
      ["asset-1:0", "asset-2:1"],
      {
        aiVisibility: ["allow"],
      }
    );
    expect(result).toEqual({
      items: [
        {
          kind: "chunk",
          score: 0.95,
          chunk: expect.objectContaining({
            vectorId: "asset-1:0",
            textPreview: "Semantic preview 1",
            asset: expect.objectContaining({
              id: "asset-1",
              title: "CloudMind Asset 1",
            }),
          }),
        },
        {
          kind: "summary",
          score: expect.any(Number),
          asset: expect.objectContaining({
            id: "asset-summary-1",
            aiVisibility: "summary_only",
          }),
          summary: "Summary-only retrieval result",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 2,
        total: 2,
        totalPages: 1,
      },
    });
  });

  it("searchAssets filters out non-allow assets from semantic results", async () => {
    const repository = new InMemorySearchRepository();
    const vectorStore = new InMemoryVectorStore();
    const service = createSearchService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStore),
      getAIProvider: getAIProviderMock.mockResolvedValue(embeddingProvider),
    });

    const result = await service.searchAssets(
      { APP_NAME: "cloudmind-test" },
      {
        query: "vector search",
        page: 1,
        pageSize: 10,
      }
    );

    expect(repository.chunkMatchQueries).toEqual([["allow"]]);
    expect(repository.summaryQueries).toEqual([
      {
        query: "vector search",
        limit: 10,
        aiVisibility: ["summary_only"],
      },
    ]);
    expect(result.items).not.toHaveLength(0);
    expect(
      result.items.every((item) =>
        item.kind === "chunk"
          ? item.chunk.asset.aiVisibility === "allow"
          : item.asset.aiVisibility === "summary_only"
      )
    ).toBe(true);
  });

  it("searchAssets returns an empty result when the embedding provider returns no vector", async () => {
    const repository = new InMemorySearchRepository();
    const vectorStore = new InMemoryVectorStore();
    const service = createSearchService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStore),
      getAIProvider: getAIProviderMock.mockResolvedValue({
        generateText: vi.fn(async () => ({
          text: "",
        })),
        createEmbeddings: vi.fn(async () => ({
          embeddings: [],
        })),
      } satisfies AIProvider),
    });

    const result = await service.searchAssets(
      { APP_NAME: "cloudmind-test" },
      {
        query: "vector search",
      }
    );

    expect(result).toEqual({
      items: [
        {
          kind: "summary",
          score: expect.any(Number),
          asset: expect.objectContaining({
            id: "asset-summary-1",
            aiVisibility: "summary_only",
          }),
          summary: "Summary-only retrieval result",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it("searchAssetsForContext keeps results inside preferred domains when fallback is disabled", async () => {
    const repository = new MixedDomainSearchRepository();
    const service = createSearchService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getVectorStore: getVectorStoreMock.mockResolvedValue(
        new FixedVectorStore([
          {
            id: "personal-1:0",
            score: 0.96,
          },
          {
            id: "engineering-1:0",
            score: 0.9,
          },
        ])
      ),
      getAIProvider: getAIProviderMock.mockResolvedValue(embeddingProvider),
    });

    const result = await service.searchAssetsForContext(
      { APP_NAME: "cloudmind-test" },
      {
        query: "debugging notes",
        page: 1,
        pageSize: 2,
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

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.kind).toBe("chunk");
    expect(
      result.items[0]?.kind === "chunk"
        ? result.items[0].chunk.asset.domain
        : null
    ).toBe("engineering");
    expect(result.resultScope).toBe("preferred_only");
  });

  it("searchAssetsForContext can widen results when fallback is enabled", async () => {
    const repository = new MixedDomainSearchRepository();
    const service = createSearchService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getVectorStore: getVectorStoreMock.mockResolvedValue(
        new FixedVectorStore([
          {
            id: "personal-1:0",
            score: 0.96,
          },
          {
            id: "engineering-1:0",
            score: 0.9,
          },
        ])
      ),
      getAIProvider: getAIProviderMock.mockResolvedValue(embeddingProvider),
    });

    const result = await service.searchAssetsForContext(
      { APP_NAME: "cloudmind-test" },
      {
        query: "debugging notes",
        page: 1,
        pageSize: 2,
      },
      {
        profile: "coding",
        preferredDomains: ["engineering", "research"],
        boostedDomains: ["engineering", "research"],
        suppressedDomains: ["personal", "finance", "health"],
        includeSummaryOnly: true,
        overfetchMultiplier: 3,
        allowFallback: true,
      }
    );

    expect(result.items).toHaveLength(2);
    expect(
      result.items.map((item) =>
        item.kind === "chunk" ? item.chunk.asset.domain : item.asset.domain
      )
    ).toEqual(["engineering", "personal"]);
    expect(result.resultScope).toBe("fallback_expanded");
  });
});
