import { describe, expect, it, vi } from "vitest";

import type { AIProvider } from "@/core/ai/ports";
import type {
  VectorSearchInput,
  VectorSearchMatch,
  VectorStore,
} from "@/core/vector/ports";
import { createTermSearchService } from "@/features/search/server/term-service";

class InMemoryVectorStore implements VectorStore {
  public constructor(private readonly matches: VectorSearchMatch[]) {}

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

describe("term search service", () => {
  it("searchTerms maps collection to catalog and merges kind results", async () => {
    const vectorStore = new InMemoryVectorStore([
      {
        id: "term:topic:cloudmind",
        score: 0.93,
        metadataJson: JSON.stringify({
          kind: "topic",
          term: "cloudmind",
          normalized: "cloudmind",
        }),
      },
      {
        id: "term:catalog:journal/2026/03",
        score: 0.88,
        metadataJson: JSON.stringify({
          kind: "catalog",
          term: "journal/2026/03",
          normalized: "journal/2026/03",
        }),
      },
      {
        id: "term:tag:mvp",
        score: 0.81,
        metadataJson: JSON.stringify({
          kind: "tag",
          term: "mvp",
          normalized: "mvp",
        }),
      },
    ]);
    const aiProvider: AIProvider = {
      generateText: vi.fn(),
      createEmbeddings: vi.fn(async () => ({
        embeddings: [[0.1, 0.2, 0.3]],
      })),
    };
    const service = createTermSearchService({
      getVectorStore: vi.fn().mockResolvedValue(vectorStore),
      getAIProvider: vi.fn().mockResolvedValue(aiProvider),
    });

    const result = await service.searchTerms(undefined, {
      query: "cloudmind journal",
      kinds: ["collection", "topic"],
      topK: 4,
    });

    expect(result).toEqual({
      items: [
        {
          kind: "topic",
          term: "cloudmind",
          normalized: "cloudmind",
          score: 0.93,
        },
        {
          kind: "collection",
          term: "journal/2026/03",
          normalized: "journal/2026/03",
          score: 0.88,
        },
      ],
    });
    expect(aiProvider.createEmbeddings).toHaveBeenCalledTimes(2);
  });

  it("searchTerms searches all kinds by default and caps output by topK", async () => {
    const vectorStore = new InMemoryVectorStore([
      {
        id: "term:topic:cloudmind",
        score: 0.91,
        metadataJson: JSON.stringify({
          kind: "topic",
          term: "cloudmind",
          normalized: "cloudmind",
        }),
      },
      {
        id: "term:tag:mvp",
        score: 0.83,
        metadataJson: JSON.stringify({
          kind: "tag",
          term: "mvp",
          normalized: "mvp",
        }),
      },
      {
        id: "term:catalog:journal/2026/03",
        score: 0.88,
        metadataJson: JSON.stringify({
          kind: "catalog",
          term: "journal/2026/03",
          normalized: "journal/2026/03",
        }),
      },
    ]);
    const aiProvider: AIProvider = {
      generateText: vi.fn(),
      createEmbeddings: vi.fn(async () => ({
        embeddings: [[0.1, 0.2, 0.3]],
      })),
    };
    const service = createTermSearchService({
      getVectorStore: vi.fn().mockResolvedValue(vectorStore),
      getAIProvider: vi.fn().mockResolvedValue(aiProvider),
    });

    const result = await service.searchTerms(undefined, {
      query: "cloudmind mvp journal",
      topK: 2,
    });

    expect(result).toEqual({
      items: [
        {
          kind: "topic",
          term: "cloudmind",
          normalized: "cloudmind",
          score: 0.91,
        },
        {
          kind: "collection",
          term: "journal/2026/03",
          normalized: "journal/2026/03",
          score: 0.88,
        },
      ],
    });
    expect(aiProvider.createEmbeddings).toHaveBeenCalledTimes(3);
  });
});
