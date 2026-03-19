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
  AssetChunkMatch,
  AssetListResult,
} from "@/features/assets/model/types";
import { createSearchService } from "@/features/search/server/service";

class InMemorySearchRepository implements AssetSearchRepository {
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
    vectorIds: string[]
  ): Promise<AssetChunkMatch[]> {
    return vectorIds.map((vectorId, index) => ({
      id: `chunk-${index + 1}`,
      chunkIndex: index,
      textPreview: `Semantic preview ${index + 1}`,
      vectorId,
      asset: {
        id: `asset-${index + 1}`,
        type: "note",
        title: `CloudMind Asset ${index + 1}`,
        summary: `Asset summary ${index + 1}`,
        sourceUrl: null,
        status: "ready",
        createdAt: "2026-03-19T00:00:00.000Z",
        updatedAt: "2026-03-19T00:00:00.000Z",
      },
    }));
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
    expect(getChunkMatchesSpy).toHaveBeenCalledWith(["asset-1:0", "asset-2:1"]);
    expect(result).toEqual({
      items: [
        {
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
          score: 0.8999999999999999,
          chunk: expect.objectContaining({
            vectorId: "asset-2:1",
            textPreview: "Semantic preview 2",
            asset: expect.objectContaining({
              id: "asset-2",
              title: "CloudMind Asset 2",
            }),
          }),
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
      items: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      },
    });
  });
});
