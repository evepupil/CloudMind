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
  public readonly chunkMatchQueries: Array<
    | {
        aiVisibility?: AssetAiVisibility[] | undefined;
        domain?: string | undefined;
        documentClass?: string | undefined;
        sourceKind?: string | undefined;
        sourceHost?: string | undefined;
        topic?: string | undefined;
        tag?: string | undefined;
        collection?: string | undefined;
        createdAtFrom?: string | undefined;
        createdAtTo?: string | undefined;
      }
    | undefined
  > = [];

  public readonly summaryQueries: Array<{
    query: string;
    limit: number;
    aiVisibility: AssetAiVisibility[];
    domain?: string | undefined;
    documentClass?: string | undefined;
    sourceKind?: string | undefined;
    sourceHost?: string | undefined;
    topic?: string | undefined;
    tag?: string | undefined;
    collection?: string | undefined;
    createdAtFrom?: string | undefined;
    createdAtTo?: string | undefined;
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
      domain?: string | undefined;
      documentClass?: string | undefined;
      sourceKind?: string | undefined;
      sourceHost?: string | undefined;
      topic?: string | undefined;
      tag?: string | undefined;
      collection?: string | undefined;
      createdAtFrom?: string | undefined;
      createdAtTo?: string | undefined;
    }
  ): Promise<AssetChunkMatch[]> {
    this.chunkMatchQueries.push(query);

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
    domain?: string | undefined;
    documentClass?: string | undefined;
    sourceKind?: string | undefined;
    sourceHost?: string | undefined;
    topic?: string | undefined;
    tag?: string | undefined;
    collection?: string | undefined;
    createdAtFrom?: string | undefined;
    createdAtTo?: string | undefined;
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

class TrackedVectorStore implements VectorStore {
  public readonly requestedTopKs: number[] = [];

  public constructor(private readonly matches: VectorSearchMatch[]) {}

  public async upsert(): Promise<void> {
    return undefined;
  }

  public async search(input: VectorSearchInput): Promise<VectorSearchMatch[]> {
    this.requestedTopKs.push(input.topK);

    return this.matches.slice(0, input.topK);
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

class AssertionFailureSearchRepository implements AssetSearchRepository {
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
        id: "chunk-d1-1",
        chunkIndex: 0,
        textPreview: "D1 and Vectorize tradeoff preview",
        contentText:
          "D1 stores structured metadata while Vectorize handles semantic recall.",
        vectorId: "asset-d1-1:0",
        asset: {
          id: "asset-d1-1",
          type: "note",
          title: "D1 Vectorize Tradeoffs",
          summary: "Tradeoff note",
          sourceUrl: null,
          sourceKind: "manual",
          status: "ready",
          domain: "engineering",
          sensitivity: "internal",
          aiVisibility: "allow",
          retrievalPriority: 12,
          collectionKey: "engineering:notes",
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

  public async searchAssetAssertions(): Promise<never> {
    throw new Error("D1_ERROR: too many SQL variables");
  }
}

class DuplicateAssetSearchRepository implements AssetSearchRepository {
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

  public async getChunkMatchesByVectorIds(): Promise<AssetChunkMatch[]> {
    return [
      {
        id: "chunk-asset-a-1",
        chunkIndex: 0,
        textPreview: "Primary retrieval note",
        contentText: "Primary retrieval note full content",
        vectorId: "asset-a:0",
        asset: {
          id: "asset-a",
          type: "note",
          title: "Asset A",
          summary: "Primary asset summary",
          sourceUrl: null,
          sourceKind: "manual",
          status: "ready",
          domain: "engineering",
          sensitivity: "internal",
          aiVisibility: "allow",
          retrievalPriority: 20,
          collectionKey: "engineering:notes",
          capturedAt: "2026-03-24T00:00:00.000Z",
          descriptorJson: null,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      },
      {
        id: "chunk-asset-a-2",
        chunkIndex: 1,
        textPreview: "Supporting retrieval note",
        contentText: "Supporting retrieval note full content",
        vectorId: "asset-a:1",
        asset: {
          id: "asset-a",
          type: "note",
          title: "Asset A",
          summary: "Primary asset summary",
          sourceUrl: null,
          sourceKind: "manual",
          status: "ready",
          domain: "engineering",
          sensitivity: "internal",
          aiVisibility: "allow",
          retrievalPriority: 20,
          collectionKey: "engineering:notes",
          capturedAt: "2026-03-24T00:00:00.000Z",
          descriptorJson: null,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      },
      {
        id: "chunk-asset-b-1",
        chunkIndex: 0,
        textPreview: "Secondary retrieval note",
        contentText: "Secondary retrieval note full content",
        vectorId: "asset-b:0",
        asset: {
          id: "asset-b",
          type: "note",
          title: "Asset B",
          summary: "Secondary asset summary",
          sourceUrl: null,
          sourceKind: "manual",
          status: "ready",
          domain: "engineering",
          sensitivity: "internal",
          aiVisibility: "allow",
          retrievalPriority: 0,
          collectionKey: "engineering:notes",
          capturedAt: "2026-02-01T00:00:00.000Z",
          descriptorJson: null,
          createdAt: "2026-02-01T00:00:00.000Z",
          updatedAt: "2026-02-01T00:00:00.000Z",
        },
      },
    ];
  }

  public async searchAssetSummaries(): Promise<AssetSummaryMatch[]> {
    return [];
  }
}

class HardFilterAwareSearchRepository implements AssetSearchRepository {
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
      domain?: string | undefined;
    }
  ): Promise<AssetChunkMatch[]> {
    const records: AssetChunkMatch[] = [
      {
        id: "chunk-personal-1",
        chunkIndex: 0,
        textPreview: "Personal retrieval note",
        contentText: "Personal retrieval note full content",
        vectorId: "personal-1:0",
        asset: {
          id: "asset-personal-1",
          type: "note",
          title: "Personal Note",
          summary: "Personal summary",
          sourceUrl: null,
          sourceKind: "manual",
          status: "ready",
          domain: "personal",
          sensitivity: "private",
          aiVisibility: "allow",
          retrievalPriority: 0,
          collectionKey: "personal:notes",
          capturedAt: "2026-03-24T00:00:00.000Z",
          descriptorJson: null,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      },
      {
        id: "chunk-engineering-1",
        chunkIndex: 1,
        textPreview: "Engineering retrieval note",
        contentText: "Engineering retrieval note full content",
        vectorId: "engineering-1:0",
        asset: {
          id: "asset-engineering-1",
          type: "note",
          title: "Engineering Note",
          summary: "Engineering summary",
          sourceUrl: null,
          sourceKind: "manual",
          status: "ready",
          domain: "engineering",
          sensitivity: "internal",
          aiVisibility: "allow",
          retrievalPriority: 0,
          collectionKey: "engineering:notes",
          capturedAt: "2026-03-24T00:00:00.000Z",
          descriptorJson: null,
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      },
    ];

    return records.filter(
      (record) =>
        vectorIds.includes(record.vectorId ?? "") &&
        (!query?.aiVisibility?.length ||
          query.aiVisibility.includes(record.asset.aiVisibility)) &&
        (!query?.domain || record.asset.domain === query.domain)
    );
  }

  public async searchAssetSummaries(): Promise<AssetSummaryMatch[]> {
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
  const searchAssetsByTermsMock = vi.fn();
  const emptyTermResult = {
    terms: [],
    items: [],
    pagination: {
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    searchAssetsByTermsMock.mockResolvedValue(emptyTermResult);
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
      searchAssetsByTerms: searchAssetsByTermsMock,
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
          indexing: expect.objectContaining({
            matchedLayer: "chunk",
            domain: "engineering",
            aiVisibility: "allow",
          }),
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
          indexing: expect.objectContaining({
            matchedLayer: "summary",
            domain: "product",
            aiVisibility: "summary_only",
          }),
          asset: expect.objectContaining({
            id: "asset-summary-1",
            aiVisibility: "summary_only",
          }),
          summary: "Summary-only retrieval result",
        },
      ],
      evidence: {
        items: [
          expect.objectContaining({
            id: "chunk:chunk-1",
            layer: "chunk",
            score: 0.95,
            text: "Semantic preview 1",
            snippet: "Semantic preview 1",
            matchReasons: expect.arrayContaining([
              expect.objectContaining({
                code: "semantic_match",
              }),
            ]),
            asset: expect.objectContaining({
              id: "asset-1",
              title: "CloudMind Asset 1",
            }),
          }),
          expect.objectContaining({
            id: "summary:asset-summary-1",
            layer: "summary",
            text: "Summary-only retrieval result",
            matchReasons: expect.arrayContaining([
              expect.objectContaining({
                code: "summary_match",
              }),
            ]),
            asset: expect.objectContaining({
              id: "asset-summary-1",
            }),
          }),
        ],
      },
      groupedEvidence: [
        {
          asset: expect.objectContaining({
            id: "asset-1",
            title: "CloudMind Asset 1",
          }),
          assetScore: expect.any(Number),
          topScore: 0.95,
          matchedLayers: ["chunk"],
          primaryEvidence: expect.objectContaining({
            id: "chunk:chunk-1",
            layer: "chunk",
          }),
          groupSummary: expect.objectContaining({
            headline: expect.any(String),
            bullets: expect.any(Array),
          }),
          items: [
            expect.objectContaining({
              id: "chunk:chunk-1",
              layer: "chunk",
            }),
          ],
        },
        {
          asset: expect.objectContaining({
            id: "asset-summary-1",
          }),
          assetScore: expect.any(Number),
          topScore: expect.any(Number),
          matchedLayers: ["summary"],
          primaryEvidence: expect.objectContaining({
            id: "summary:asset-summary-1",
            layer: "summary",
          }),
          groupSummary: expect.objectContaining({
            headline: expect.any(String),
            bullets: expect.any(Array),
          }),
          items: [
            expect.objectContaining({
              id: "summary:asset-summary-1",
              layer: "summary",
            }),
          ],
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
      searchAssetsByTerms: searchAssetsByTermsMock,
    });

    const result = await service.searchAssets(
      { APP_NAME: "cloudmind-test" },
      {
        query: "vector search",
        page: 1,
        pageSize: 10,
      }
    );

    expect(repository.chunkMatchQueries).toEqual([
      {
        aiVisibility: ["allow"],
      },
    ]);
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
          : item.kind === "assertion"
            ? ["allow", "summary_only"].includes(
                item.assertion.asset.aiVisibility
              )
            : item.kind === "term"
              ? ["allow", "summary_only"].includes(item.asset.aiVisibility)
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
      searchAssetsByTerms: searchAssetsByTermsMock,
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
          indexing: expect.objectContaining({
            matchedLayer: "summary",
            domain: "product",
          }),
          asset: expect.objectContaining({
            id: "asset-summary-1",
            aiVisibility: "summary_only",
          }),
          summary: "Summary-only retrieval result",
        },
      ],
      evidence: {
        items: [
          expect.objectContaining({
            id: "summary:asset-summary-1",
            layer: "summary",
            text: "Summary-only retrieval result",
            matchReasons: expect.arrayContaining([
              expect.objectContaining({
                code: "summary_match",
              }),
            ]),
            asset: expect.objectContaining({
              id: "asset-summary-1",
            }),
          }),
        ],
      },
      groupedEvidence: [
        {
          asset: expect.objectContaining({
            id: "asset-summary-1",
          }),
          assetScore: expect.any(Number),
          topScore: expect.any(Number),
          matchedLayers: ["summary"],
          primaryEvidence: expect.objectContaining({
            id: "summary:asset-summary-1",
            layer: "summary",
          }),
          groupSummary: expect.objectContaining({
            headline: expect.any(String),
            bullets: expect.any(Array),
          }),
          items: [
            expect.objectContaining({
              id: "summary:asset-summary-1",
              layer: "summary",
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
      searchAssetsByTerms: searchAssetsByTermsMock,
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
      searchAssetsByTerms: searchAssetsByTermsMock,
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
        item.kind === "chunk"
          ? item.chunk.asset.domain
          : item.kind === "assertion"
            ? item.assertion.asset.domain
            : item.kind === "term"
              ? item.asset.domain
              : item.asset.domain
      )
    ).toEqual(["engineering", "personal"]);
    expect(result.resultScope).toBe("fallback_expanded");
  });

  it("searchAssets paginates by asset group and keeps supporting evidence inside the same asset card", async () => {
    const repository = new DuplicateAssetSearchRepository();
    const service = createSearchService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getVectorStore: getVectorStoreMock.mockResolvedValue(
        new FixedVectorStore([
          {
            id: "asset-a:0",
            score: 0.94,
          },
          {
            id: "asset-a:1",
            score: 0.88,
          },
          {
            id: "asset-b:0",
            score: 0.9,
          },
        ])
      ),
      getAIProvider: getAIProviderMock.mockResolvedValue(embeddingProvider),
      searchAssetsByTerms: searchAssetsByTermsMock,
    });

    const result = await service.searchAssets(
      { APP_NAME: "cloudmind-test" },
      {
        query: "retrieval note",
        page: 1,
        pageSize: 1,
      }
    );

    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
    expect(result.groupedEvidence).toHaveLength(1);
    expect(result.groupedEvidence[0]).toEqual({
      asset: expect.objectContaining({
        id: "asset-a",
      }),
      assetScore: expect.any(Number),
      topScore: 0.94,
      matchedLayers: ["chunk"],
      primaryEvidence: expect.objectContaining({
        id: "chunk:chunk-asset-a-1",
      }),
      groupSummary: expect.objectContaining({
        headline: expect.any(String),
        bullets: expect.any(Array),
      }),
      items: [
        expect.objectContaining({
          id: "chunk:chunk-asset-a-1",
        }),
        expect.objectContaining({
          id: "chunk:chunk-asset-a-2",
        }),
      ],
    });
    expect(result.items).toHaveLength(2);
    expect(
      result.items.every(
        (item) => item.kind === "chunk" && item.chunk.asset.id === "asset-a"
      )
    ).toBe(true);
  });

  it("searchAssets keeps working when assertion lexical search fails", async () => {
    const repository = new AssertionFailureSearchRepository();
    const service = createSearchService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getVectorStore: getVectorStoreMock.mockResolvedValue(
        new FixedVectorStore([
          {
            id: "asset-d1-1:0",
            score: 0.93,
          },
        ])
      ),
      getAIProvider: getAIProviderMock.mockResolvedValue(embeddingProvider),
      searchAssetsByTerms: searchAssetsByTermsMock,
    });

    const result = await service.searchAssets(
      { APP_NAME: "cloudmind-test" },
      {
        query:
          "Can you explain the D1 and Vectorize tradeoff in CloudMind using a long natural language query that used to trigger lexical assertion SQL errors?",
        page: 1,
        pageSize: 5,
      }
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.kind).toBe("chunk");
    expect(
      result.items[0]?.kind === "chunk" ? result.items[0].chunk.asset.id : null
    ).toBe("asset-d1-1");
  });

  it("searchAssets fuses metadata term hits into the main result stream", async () => {
    const repository = new InMemorySearchRepository();
    const vectorStore = new FixedVectorStore([]);
    const service = createSearchService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStore),
      getAIProvider: getAIProviderMock.mockResolvedValue(embeddingProvider),
      searchAssetsByTerms: searchAssetsByTermsMock.mockResolvedValue({
        terms: [
          {
            kind: "topic",
            term: "cloudmind",
            normalized: "cloudmind",
            score: 0.92,
          },
        ],
        items: [
          {
            asset: {
              id: "asset-term-1",
              type: "note",
              title: "CloudMind Metadata Plan",
              summary: "Plan for metadata-term retrieval fusion.",
              sourceUrl: null,
              sourceKind: "manual",
              status: "ready",
              domain: "engineering",
              sensitivity: "internal",
              aiVisibility: "allow",
              retrievalPriority: 15,
              collectionKey: "engineering:notes",
              capturedAt: "2026-03-24T00:00:00.000Z",
              descriptorJson: null,
              createdAt: "2026-03-24T00:00:00.000Z",
              updatedAt: "2026-03-24T00:00:00.000Z",
            },
            matchedTerms: [
              {
                facetKey: "topic",
                facetValue: "cloudmind",
              },
            ],
          },
        ],
        pagination: {
          page: 1,
          pageSize: 5,
          total: 1,
          totalPages: 1,
        },
      }),
    });

    const result = await service.searchAssets(
      { APP_NAME: "cloudmind-test" },
      {
        query: "cloudmind metadata",
        page: 1,
        pageSize: 5,
      }
    );

    expect(result.items.some((item) => item.kind === "term")).toBe(true);
    expect(
      result.groupedEvidence.some((group) => group.asset.id === "asset-term-1")
    ).toBe(true);
    expect(result.evidence.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "term:asset-term-1",
          layer: "term",
          matchedTerms: [
            {
              facetKey: "topic",
              facetValue: "cloudmind",
            },
          ],
          matchReasons: expect.arrayContaining([
            expect.objectContaining({
              code: "term_match",
            }),
          ]),
        }),
      ])
    );
  });

  it("searchAssets keeps chunk evidence primary when a term hit recalls the same asset", async () => {
    const repository = new DuplicateAssetSearchRepository();
    const service = createSearchService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getVectorStore: getVectorStoreMock.mockResolvedValue(
        new FixedVectorStore([
          {
            id: "asset-a:0",
            score: 0.94,
          },
        ])
      ),
      getAIProvider: getAIProviderMock.mockResolvedValue(embeddingProvider),
      searchAssetsByTerms: searchAssetsByTermsMock.mockResolvedValue({
        terms: [
          {
            kind: "topic",
            term: "asset-a",
            normalized: "asset-a",
            score: 0.95,
          },
        ],
        items: [
          {
            asset: {
              id: "asset-a",
              type: "note",
              title: "Asset A",
              summary: "Primary asset summary",
              sourceUrl: null,
              sourceKind: "manual",
              status: "ready",
              domain: "engineering",
              sensitivity: "internal",
              aiVisibility: "allow",
              retrievalPriority: 20,
              collectionKey: "engineering:notes",
              capturedAt: "2026-03-24T00:00:00.000Z",
              descriptorJson: null,
              createdAt: "2026-03-24T00:00:00.000Z",
              updatedAt: "2026-03-24T00:00:00.000Z",
            },
            matchedTerms: [
              {
                facetKey: "topic",
                facetValue: "asset-a",
              },
            ],
          },
        ],
        pagination: {
          page: 1,
          pageSize: 5,
          total: 1,
          totalPages: 1,
        },
      }),
    });

    const result = await service.searchAssets(
      { APP_NAME: "cloudmind-test" },
      {
        query: "asset a retrieval",
        page: 1,
        pageSize: 5,
      }
    );

    expect(result.groupedEvidence[0]?.asset.id).toBe("asset-a");
    expect(result.groupedEvidence[0]?.matchedLayers).toEqual(["chunk", "term"]);
    expect(result.groupedEvidence[0]?.primaryEvidence.layer).toBe("chunk");
  });

  it("searchAssets overfetches vector hits when hard filters exclude top semantic matches", async () => {
    const repository = new HardFilterAwareSearchRepository();
    const vectorStore = new TrackedVectorStore([
      {
        id: "personal-1:0",
        score: 0.99,
      },
      {
        id: "personal-2:0",
        score: 0.98,
      },
      {
        id: "engineering-1:0",
        score: 0.97,
      },
    ]);
    const service = createSearchService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStore),
      getAIProvider: getAIProviderMock.mockResolvedValue(embeddingProvider),
      searchAssetsByTerms: searchAssetsByTermsMock,
    });

    const result = await service.searchAssets(
      { APP_NAME: "cloudmind-test" },
      {
        query: "engineering retrieval",
        page: 1,
        pageSize: 1,
        domain: "engineering",
      }
    );

    expect(vectorStore.requestedTopKs).toEqual([1, 3]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.kind).toBe("chunk");
    expect(
      result.items[0]?.kind === "chunk"
        ? result.items[0].chunk.asset.domain
        : null
    ).toBe("engineering");
  });

  it("searchAssets forwards hard filters to chunk, summary, and term retrieval", async () => {
    const repository = new InMemorySearchRepository();
    const vectorStore = new InMemoryVectorStore();
    const service = createSearchService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStore),
      getAIProvider: getAIProviderMock.mockResolvedValue(embeddingProvider),
      searchAssetsByTerms: searchAssetsByTermsMock,
    });

    await service.searchAssets(
      { APP_NAME: "cloudmind-test" },
      {
        query: "cloudmind filters",
        page: 1,
        pageSize: 5,
        domain: "engineering",
        documentClass: "design_doc",
        sourceKind: "manual",
        sourceHost: "developers.cloudflare.com",
        topic: "cloudmind",
        tag: "mvp",
        collection: "project/cloudmind",
        createdAtFrom: "2026-01-01T00:00:00.000Z",
        createdAtTo: "2026-12-31T23:59:59.999Z",
      }
    );

    expect(repository.summaryQueries[0]).toEqual(
      expect.objectContaining({
        query: "cloudmind filters",
        domain: "engineering",
        documentClass: "design_doc",
        sourceKind: "manual",
        sourceHost: "developers.cloudflare.com",
        topic: "cloudmind",
        tag: "mvp",
        collection: "project/cloudmind",
        createdAtFrom: "2026-01-01T00:00:00.000Z",
        createdAtTo: "2026-12-31T23:59:59.999Z",
      })
    );
    expect(repository.chunkMatchQueries[0]).toEqual({
      aiVisibility: ["allow"],
      domain: "engineering",
      documentClass: "design_doc",
      sourceKind: "manual",
      sourceHost: "developers.cloudflare.com",
      topic: "cloudmind",
      tag: "mvp",
      collection: "project/cloudmind",
      createdAtFrom: "2026-01-01T00:00:00.000Z",
      createdAtTo: "2026-12-31T23:59:59.999Z",
    });
    expect(searchAssetsByTermsMock).toHaveBeenCalledWith(
      { APP_NAME: "cloudmind-test" },
      {
        query: "cloudmind filters",
        filters: {
          domain: "engineering",
          documentClass: "design_doc",
          sourceKind: "manual",
          sourceHost: "developers.cloudflare.com",
          topic: "cloudmind",
          tag: "mvp",
          collection: "project/cloudmind",
          createdAtFrom: "2026-01-01T00:00:00.000Z",
          createdAtTo: "2026-12-31T23:59:59.999Z",
          type: undefined,
        },
        topK: 5,
        page: 1,
        pageSize: 5,
      }
    );
  });
});
