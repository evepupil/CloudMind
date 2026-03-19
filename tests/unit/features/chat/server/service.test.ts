import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AIProvider } from "@/core/ai/ports";
import type { AssetSearchRepository } from "@/core/assets/ports";
import type {
  VectorSearchInput,
  VectorSearchMatch,
  VectorStore,
} from "@/core/vector/ports";
import type { AssetChunkMatch, AssetListResult } from "@/features/assets/model/types";
import { createChatService } from "@/features/chat/server/service";

class InMemorySearchRepository implements AssetSearchRepository {
  public async searchAssets(): Promise<AssetListResult> {
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
      textPreview: `Source snippet ${index + 1}`,
      contentText: `Full chunk body ${index + 1}`,
      vectorId,
      asset: {
        id: `asset-${index + 1}`,
        type: "note",
        title: `Asset ${index + 1}`,
        summary: `Summary ${index + 1}`,
        sourceUrl: index === 0 ? "https://example.com/cloudmind" : null,
        status: "ready",
        createdAt: "2026-03-19T00:00:00.000Z",
        updatedAt: "2026-03-19T00:00:00.000Z",
      },
    }));
  }
}

class InMemoryVectorStore implements VectorStore {
  public constructor(
    private readonly matches: VectorSearchMatch[]
  ) {}

  public async upsert(): Promise<void> {
    return undefined;
  }

  public async search(_input: VectorSearchInput): Promise<VectorSearchMatch[]> {
    return this.matches;
  }

  public async deleteByIds(): Promise<void> {
    return undefined;
  }
}

describe("chat service", () => {
  const getAssetRepositoryMock = vi.fn();
  const getVectorStoreMock = vi.fn();
  const getAiProviderMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("askLibrary generates an answer grounded in retrieved chunk sources", async () => {
    const repository = new InMemorySearchRepository();
    const vectorStore = new InMemoryVectorStore([
      {
        id: "asset-1:0",
        score: 0.97,
      },
      {
        id: "asset-2:1",
        score: 0.88,
      },
    ]);
    const aiProvider: AIProvider = {
      createEmbeddings: vi.fn(async () => ({
        embeddings: [[0.11, 0.22, 0.33]],
      })),
      generateText: vi.fn(async () => ({
        text: "CloudMind emphasizes source-aware answers [S1].",
      })),
    };
    const service = createChatService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStore),
      getAiProvider: getAiProviderMock.mockResolvedValue(aiProvider),
    });

    const result = await service.askLibrary(
      { APP_NAME: "cloudmind-test" },
      {
        question: "What does CloudMind emphasize?",
        topK: 2,
      }
    );

    expect(aiProvider.createEmbeddings).toHaveBeenCalledWith({
      texts: ["What does CloudMind emphasize?"],
      purpose: "query",
    });
    expect(aiProvider.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("[S1] Asset 1"),
      })
    );
    expect(aiProvider.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Snippet: Full chunk body 1"),
      })
    );
    expect(result).toEqual({
      answer: "CloudMind emphasizes source-aware answers [S1].",
      sources: [
        {
          assetId: "asset-1",
          chunkId: "chunk-1",
          title: "Asset 1",
          sourceUrl: "https://example.com/cloudmind",
          snippet: "Source snippet 1",
        },
        {
          assetId: "asset-2",
          chunkId: "chunk-2",
          title: "Asset 2",
          sourceUrl: null,
          snippet: "Source snippet 2",
        },
      ],
    });
  });

  it("askLibrary returns a fallback answer when vector search finds nothing", async () => {
    const repository = new InMemorySearchRepository();
    const vectorStore = new InMemoryVectorStore([]);
    const aiProvider: AIProvider = {
      createEmbeddings: vi.fn(async () => ({
        embeddings: [[0.11, 0.22, 0.33]],
      })),
      generateText: vi.fn(async () => ({
        text: "unused",
      })),
    };
    const service = createChatService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStore),
      getAiProvider: getAiProviderMock.mockResolvedValue(aiProvider),
    });

    const result = await service.askLibrary(
      { APP_NAME: "cloudmind-test" },
      {
        question: "What does CloudMind emphasize?",
      }
    );

    expect(result).toEqual({
      answer:
        "I could not find enough relevant context in your library to answer that yet.",
      sources: [],
    });
    expect(aiProvider.generateText).not.toHaveBeenCalled();
  });
});
