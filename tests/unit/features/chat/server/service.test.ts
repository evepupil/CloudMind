import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AIProvider } from "@/core/ai/ports";
import type { AssetSearchRepository } from "@/core/assets/ports";
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
import { createChatService } from "@/features/chat/server/service";

class InMemorySearchRepository implements AssetSearchRepository {
  public readonly chunkMatchQueries: Array<AssetAiVisibility[] | undefined> =
    [];

  public readonly summaryQueries: Array<{
    query: string;
    limit: number;
    aiVisibility: AssetAiVisibility[];
  }> = [];

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
        textPreview: `Source snippet ${index + 1}`,
        contentText: `Full chunk body ${index + 1}`,
        vectorId,
        asset: {
          id: `asset-${index + 1}`,
          type: "note" as const,
          title: `Asset ${index + 1}`,
          summary: `Summary ${index + 1}`,
          sourceUrl: index === 0 ? "https://example.com/cloudmind" : null,
          sourceKind: "manual" as const,
          status: "ready" as const,
          domain: "engineering" as const,
          sensitivity: "internal" as const,
          aiVisibility: index === 1 ? ("deny" as const) : ("allow" as const),
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
          title: "Summary Asset 1",
          summary: "Summary-only note about deployment tradeoffs.",
          sourceUrl: null,
          sourceKind: "manual",
          status: "ready",
          domain: "product",
          sensitivity: "private",
          aiVisibility: "summary_only",
          retrievalPriority: 24,
          collectionKey: "inbox:notes",
          capturedAt: "2026-03-19T00:00:00.000Z",
          descriptorJson: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          updatedAt: "2026-03-19T00:00:00.000Z",
        },
        summary: "Summary-only note about deployment tradeoffs.",
      },
    ];
  }
}

class DeniedOnlySearchRepository implements AssetSearchRepository {
  public readonly chunkMatchQueries: Array<AssetAiVisibility[] | undefined> =
    [];

  public readonly summaryQueries: Array<{
    query: string;
    limit: number;
    aiVisibility: AssetAiVisibility[];
  }> = [];

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
    vectorIds: string[],
    query?: {
      aiVisibility?: AssetAiVisibility[] | undefined;
    }
  ): Promise<AssetChunkMatch[]> {
    this.chunkMatchQueries.push(query?.aiVisibility);

    return vectorIds
      .map((vectorId, index) => ({
        id: `denied-chunk-${index + 1}`,
        chunkIndex: index,
        textPreview: `Denied snippet ${index + 1}`,
        contentText: `Denied body ${index + 1}`,
        vectorId,
        asset: {
          id: `denied-asset-${index + 1}`,
          type: "note" as const,
          title: `Denied Asset ${index + 1}`,
          summary: `Denied Summary ${index + 1}`,
          sourceUrl: null,
          sourceKind: "manual" as const,
          status: "ready" as const,
          domain: "personal" as const,
          sensitivity: "restricted" as const,
          aiVisibility: "deny" as const,
          retrievalPriority: -30,
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

    return [];
  }
}

class SummaryOnlySearchRepository implements AssetSearchRepository {
  public readonly chunkMatchQueries: Array<AssetAiVisibility[] | undefined> =
    [];

  public readonly summaryQueries: Array<{
    query: string;
    limit: number;
    aiVisibility: AssetAiVisibility[];
  }> = [];

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
    _vectorIds: string[],
    query?: {
      aiVisibility?: AssetAiVisibility[] | undefined;
    }
  ): Promise<AssetChunkMatch[]> {
    this.chunkMatchQueries.push(query?.aiVisibility);

    return [];
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
          id: "asset-summary-only-1",
          type: "note",
          title: "Private deployment notes",
          summary: "Summary-only note about a previous deployment incident.",
          sourceUrl: null,
          sourceKind: "manual",
          status: "ready",
          domain: "engineering",
          sensitivity: "private",
          aiVisibility: "summary_only",
          retrievalPriority: 28,
          collectionKey: "inbox:notes",
          capturedAt: "2026-03-19T00:00:00.000Z",
          descriptorJson: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          updatedAt: "2026-03-19T00:00:00.000Z",
        },
        summary: "Summary-only note about a previous deployment incident.",
      },
    ];
  }
}

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

class ContextRankingSearchRepository implements AssetSearchRepository {
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
    _vectorIds: string[],
    query?: {
      aiVisibility?: AssetAiVisibility[] | undefined;
    }
  ): Promise<AssetChunkMatch[]> {
    const matches: AssetChunkMatch[] = [
      {
        id: "personal-chunk-1",
        chunkIndex: 0,
        textPreview: "Personal bug note",
        contentText: "Personal bug note full content",
        vectorId: "personal-1:0",
        asset: {
          id: "asset-personal-1",
          type: "note",
          title: "Personal Bug Diary",
          summary: "A personal note about a debugging issue",
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
        id: "engineering-chunk-1",
        chunkIndex: 1,
        textPreview: "Engineering debugging guide",
        contentText: "Engineering debugging guide full content",
        vectorId: "engineering-1:0",
        asset: {
          id: "asset-engineering-1",
          type: "note",
          title: "Engineering Debugging Guide",
          summary: "A team note about debugging patterns",
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
    const allowed = query?.aiVisibility;

    if (!allowed?.length) {
      return matches;
    }

    return matches.filter((match) =>
      allowed.includes(match.asset.aiVisibility)
    );
  }

  public async searchAssetSummaries(_input: {
    query: string;
    limit: number;
    aiVisibility: AssetAiVisibility[];
  }): Promise<AssetSummaryMatch[]> {
    return [];
  }
}

class WeakContextSearchRepository implements AssetSearchRepository {
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
    _vectorIds: string[],
    query?: {
      aiVisibility?: AssetAiVisibility[] | undefined;
    }
  ): Promise<AssetChunkMatch[]> {
    const matches: AssetChunkMatch[] = [
      {
        id: "weak-engineering-chunk-1",
        chunkIndex: 0,
        textPreview: "Engineering team retrospective",
        contentText: "Engineering team retrospective about sprint cadence.",
        vectorId: "engineering-weak-1:0",
        asset: {
          id: "asset-engineering-weak-1",
          type: "note",
          title: "Engineering Retrospective",
          summary: "A retrospective note about team process",
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
    const allowed = query?.aiVisibility;

    if (!allowed?.length) {
      return matches;
    }

    return matches.filter((match) =>
      allowed.includes(match.asset.aiVisibility)
    );
  }

  public async searchAssetSummaries(_input: {
    query: string;
    limit: number;
    aiVisibility: AssetAiVisibility[];
  }): Promise<AssetSummaryMatch[]> {
    return [];
  }
}

class NoisySourceSearchRepository implements AssetSearchRepository {
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
    _vectorIds: string[],
    query?: {
      aiVisibility?: AssetAiVisibility[] | undefined;
    }
  ): Promise<AssetChunkMatch[]> {
    const matches: AssetChunkMatch[] = [
      {
        id: "primary-chunk-1",
        chunkIndex: 0,
        textPreview: "Retry worker runbook preview",
        contentText:
          "Retry worker runbook explains how to recover failed jobs.",
        vectorId: "primary-1:0",
        asset: {
          id: "asset-primary-1",
          type: "note",
          title: "Retry Worker Runbook",
          summary: "Retry worker runbook for failed ingestion jobs.",
          sourceUrl: null,
          sourceKind: "manual",
          status: "ready",
          domain: "engineering",
          sensitivity: "internal",
          aiVisibility: "allow",
          retrievalPriority: 16,
          collectionKey: "ops:runbooks",
          capturedAt: "2026-03-19T00:00:00.000Z",
          descriptorJson: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          updatedAt: "2026-03-19T00:00:00.000Z",
        },
      },
    ];
    const allowed = query?.aiVisibility;

    if (!allowed?.length) {
      return matches;
    }

    return matches.filter((match) =>
      allowed.includes(match.asset.aiVisibility)
    );
  }

  public async searchAssetSummaries(_input: {
    query: string;
    limit: number;
    aiVisibility: AssetAiVisibility[];
  }): Promise<AssetSummaryMatch[]> {
    return [
      {
        asset: {
          id: "asset-primary-1",
          type: "note",
          title: "Retry Worker Runbook",
          summary: "Retry worker runbook for failed ingestion jobs.",
          sourceUrl: null,
          sourceKind: "manual",
          status: "ready",
          domain: "engineering",
          sensitivity: "internal",
          aiVisibility: "summary_only",
          retrievalPriority: 16,
          collectionKey: "ops:runbooks",
          capturedAt: "2026-03-19T00:00:00.000Z",
          descriptorJson: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          updatedAt: "2026-03-19T00:00:00.000Z",
        },
        summary: "Retry worker runbook for failed ingestion jobs.",
      },
      {
        asset: {
          id: "asset-noise-1",
          type: "note",
          title: "Weekend Packing List",
          summary: "A checklist for weekend travel.",
          sourceUrl: null,
          sourceKind: "manual",
          status: "ready",
          domain: "personal",
          sensitivity: "private",
          aiVisibility: "summary_only",
          retrievalPriority: -20,
          collectionKey: "personal:notes",
          capturedAt: "2026-03-19T00:00:00.000Z",
          descriptorJson: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          updatedAt: "2026-03-19T00:00:00.000Z",
        },
        summary: "A checklist for weekend travel.",
      },
    ];
  }
}

class AssertionFailureSearchRepository implements AssetSearchRepository {
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
    vectorIds: string[],
    query?: {
      aiVisibility?: AssetAiVisibility[] | undefined;
    }
  ): Promise<AssetChunkMatch[]> {
    const matches = vectorIds.map((vectorId) => ({
      id: "stable-chunk-1",
      chunkIndex: 0,
      textPreview: "D1 and Vectorize tradeoff preview",
      contentText:
        "This note explains the D1 and Vectorize tradeoff for CloudMind search.",
      vectorId,
      asset: {
        id: "asset-stable-1",
        type: "note" as const,
        title: "D1 Vectorize Tradeoffs",
        summary: "Tradeoffs between D1 metadata and Vectorize retrieval.",
        sourceUrl: null,
        sourceKind: "manual" as const,
        status: "ready" as const,
        domain: "engineering" as const,
        sensitivity: "internal" as const,
        aiVisibility: "allow" as const,
        retrievalPriority: 14,
        collectionKey: "engineering:notes",
        capturedAt: "2026-03-19T00:00:00.000Z",
        descriptorJson: null,
        createdAt: "2026-03-19T00:00:00.000Z",
        updatedAt: "2026-03-19T00:00:00.000Z",
      },
    }));
    const allowed = query?.aiVisibility;

    if (!allowed?.length) {
      return matches;
    }

    return matches.filter((match) =>
      allowed.includes(match.asset.aiVisibility)
    );
  }

  public async searchAssetSummaries(): Promise<AssetSummaryMatch[]> {
    return [];
  }

  public async searchAssetAssertions(): Promise<never> {
    throw new Error("D1_ERROR: too many SQL variables");
  }
}

class QueryRelevanceSearchRepository implements AssetSearchRepository {
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
    _vectorIds: string[],
    query?: {
      aiVisibility?: AssetAiVisibility[] | undefined;
    }
  ): Promise<AssetChunkMatch[]> {
    const matches: AssetChunkMatch[] = [
      {
        id: "chunk-architecture-1",
        chunkIndex: 0,
        textPreview: "General architecture decision preview",
        contentText:
          "This architecture decision discusses serverless deployment patterns and storage choices.",
        vectorId: "architecture-1:0",
        asset: {
          id: "asset-architecture-1",
          type: "note",
          title: "Architecture Decision Record",
          summary: "General architecture notes",
          sourceUrl: null,
          sourceKind: "manual",
          status: "ready",
          domain: "engineering",
          sensitivity: "internal",
          aiVisibility: "allow",
          retrievalPriority: 10,
          collectionKey: "architecture:adrs",
          capturedAt: "2026-03-19T00:00:00.000Z",
          descriptorJson: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          updatedAt: "2026-03-19T00:00:00.000Z",
        },
      },
      {
        id: "chunk-honox-1",
        chunkIndex: 1,
        textPreview: "HonoX monorepo notes preview",
        contentText:
          "These HonoX monorepo notes compare monorepo structure decisions in CloudMind.",
        vectorId: "honox-1:0",
        asset: {
          id: "asset-honox-1",
          type: "note",
          title: "HonoX Monorepo Notes",
          summary: "HonoX and monorepo implementation notes",
          sourceUrl: null,
          sourceKind: "manual",
          status: "ready",
          domain: "engineering",
          sensitivity: "internal",
          aiVisibility: "allow",
          retrievalPriority: 8,
          collectionKey: "engineering:notes",
          capturedAt: "2026-03-19T00:00:00.000Z",
          descriptorJson: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          updatedAt: "2026-03-19T00:00:00.000Z",
        },
      },
    ];
    const allowed = query?.aiVisibility;

    if (!allowed?.length) {
      return matches;
    }

    return matches.filter((match) =>
      allowed.includes(match.asset.aiVisibility)
    );
  }

  public async searchAssetSummaries(): Promise<AssetSummaryMatch[]> {
    return [];
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
    expect(repository.chunkMatchQueries).toEqual([["allow"]]);
    expect(repository.summaryQueries).toEqual([
      {
        query: "What does CloudMind emphasize?",
        limit: 2,
        aiVisibility: ["summary_only"],
      },
    ]);
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
          sourceType: "chunk",
          assetId: "asset-1",
          chunkId: "chunk-1",
          title: "Asset 1",
          sourceUrl: "https://example.com/cloudmind",
          snippet: "Source snippet 1",
        },
      ],
      indexingSummary: {
        matchedLayers: ["chunk"],
        domains: ["engineering"],
        documentClasses: [],
        sourceKinds: ["manual"],
        sourceHosts: [],
        collections: ["inbox:notes"],
        topics: [],
      },
    });
  });

  it("askLibrary returns a fallback answer when all retrieved chunks are not AI-visible", async () => {
    const repository = new DeniedOnlySearchRepository();
    const vectorStore = new InMemoryVectorStore([
      {
        id: "denied-asset-1:0",
        score: 0.91,
      },
    ]);
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
        question: "What is hidden?",
        topK: 1,
      }
    );

    expect(repository.chunkMatchQueries).toEqual([["allow"]]);
    expect(repository.summaryQueries).toEqual([
      {
        query: "What is hidden?",
        limit: 1,
        aiVisibility: ["summary_only"],
      },
    ]);
    expect(result).toEqual({
      answer:
        "I could not find enough relevant context in your library to answer that yet.",
      sources: [],
    });
    expect(aiProvider.generateText).not.toHaveBeenCalled();
  });

  it("askLibrary can answer from summary-only assets when chunk retrieval is empty", async () => {
    const repository = new SummaryOnlySearchRepository();
    const vectorStore = new InMemoryVectorStore([]);
    const aiProvider: AIProvider = {
      createEmbeddings: vi.fn(async () => ({
        embeddings: [[0.11, 0.22, 0.33]],
      })),
      generateText: vi.fn(async () => ({
        text: "A previous deployment incident was captured in a summary-only note [S1].",
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
        question: "What happened in the previous deployment incident?",
        topK: 3,
      }
    );

    expect(repository.chunkMatchQueries).toEqual([]);
    expect(repository.summaryQueries).toEqual([
      {
        query: "What happened in the previous deployment incident?",
        limit: 3,
        aiVisibility: ["summary_only"],
      },
    ]);
    expect(aiProvider.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Source Type: summary"),
      })
    );
    expect(result).toEqual({
      answer:
        "A previous deployment incident was captured in a summary-only note [S1].",
      sources: [
        {
          sourceType: "summary",
          assetId: "asset-summary-only-1",
          title: "Private deployment notes",
          sourceUrl: null,
          snippet: "Summary-only note about a previous deployment incident.",
        },
      ],
      indexingSummary: {
        matchedLayers: ["summary"],
        domains: ["engineering"],
        documentClasses: [],
        sourceKinds: ["manual"],
        sourceHosts: [],
        collections: ["inbox:notes"],
        topics: [],
      },
    });
  });

  it("askLibrary returns a fallback answer when vector search finds nothing", async () => {
    const repository = new DeniedOnlySearchRepository();
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

    expect(repository.summaryQueries).toEqual([
      {
        query: "What does CloudMind emphasize?",
        limit: 5,
        aiVisibility: ["summary_only"],
      },
    ]);
    expect(result).toEqual({
      answer:
        "I could not find enough relevant context in your library to answer that yet.",
      sources: [],
    });
    expect(aiProvider.generateText).not.toHaveBeenCalled();
  });

  it("askLibrary strips echoed source blocks and repeated sentences from model output", async () => {
    const repository = new InMemorySearchRepository();
    const vectorStore = new InMemoryVectorStore([
      {
        id: "asset-1:0",
        score: 0.97,
      },
    ]);
    const aiProvider: AIProvider = {
      createEmbeddings: vi.fn(async () => ({
        embeddings: [[0.11, 0.22, 0.33]],
      })),
      generateText: vi.fn(async () => ({
        text: [
          "CloudMind emphasizes source-aware answers [S1].",
          "CloudMind emphasizes source-aware answers [S1].",
          "",
          "Sources:",
          "[S1] Asset 1",
          "Asset ID: asset-1",
          "Source Type: chunk",
          "Snippet: Full chunk body 1",
        ].join("\n"),
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
        topK: 1,
      }
    );

    expect(result.answer).toBe(
      "CloudMind emphasizes source-aware answers [S1]."
    );
    expect(result.answer).not.toContain("Sources:");
    expect(result.answer).not.toContain("Asset ID:");
    expect(aiProvider.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("Do not repeat the source list."),
      })
    );
  });

  it("askLibrary drops noisy fallback sources from the final source list", async () => {
    const repository = new NoisySourceSearchRepository();
    const vectorStore = new InMemoryVectorStore([
      {
        id: "primary-1:0",
        score: 0.96,
      },
    ]);
    const aiProvider: AIProvider = {
      createEmbeddings: vi.fn(async () => ({
        embeddings: [[0.11, 0.22, 0.33]],
      })),
      generateText: vi.fn(async () => ({
        text: "Use the retry worker runbook [S1].",
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
        question: "How do I retry failed ingestion jobs?",
        topK: 3,
      }
    );

    expect(result.sources).toEqual([
      {
        sourceType: "chunk",
        assetId: "asset-primary-1",
        chunkId: "primary-chunk-1",
        title: "Retry Worker Runbook",
        sourceUrl: null,
        snippet: "Retry worker runbook preview",
      },
    ]);
    expect(result.indexingSummary).toEqual({
      matchedLayers: ["chunk"],
      domains: ["engineering"],
      documentClasses: [],
      sourceKinds: ["manual"],
      sourceHosts: [],
      collections: ["ops:runbooks"],
      topics: [],
    });
  });

  it("askLibrary keeps answering when assertion lexical search fails", async () => {
    const repository = new AssertionFailureSearchRepository();
    const vectorStore = new InMemoryVectorStore([
      {
        id: "stable-1:0",
        score: 0.93,
      },
    ]);
    const aiProvider: AIProvider = {
      createEmbeddings: vi.fn(async () => ({
        embeddings: [[0.31, 0.22, 0.13]],
      })),
      generateText: vi.fn(async () => ({
        text: "CloudMind splits metadata in D1 and semantic recall in Vectorize [S1].",
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
        question:
          "Can you explain the D1 and Vectorize tradeoff in CloudMind using a longer natural language query that would previously blow up lexical assertion search?",
        topK: 2,
      }
    );

    expect(result.answer).toContain("D1");
    expect(result.sources).toEqual([
      {
        sourceType: "chunk",
        assetId: "asset-stable-1",
        chunkId: "stable-chunk-1",
        title: "D1 Vectorize Tradeoffs",
        sourceUrl: null,
        snippet: "D1 and Vectorize tradeoff preview",
      },
    ]);
  });

  it("askLibraryForContext answers from a single strong relevant chunk", async () => {
    const repository = new AssertionFailureSearchRepository();
    const vectorStore = new InMemoryVectorStore([
      {
        id: "stable-1:0",
        score: 0.91,
      },
    ]);
    const aiProvider: AIProvider = {
      createEmbeddings: vi.fn(async () => ({
        embeddings: [[0.31, 0.22, 0.13]],
      })),
      generateText: vi.fn(async () => ({
        text: "D1 keeps metadata queryable while Vectorize handles semantic retrieval [S1].",
      })),
    };
    const service = createChatService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStore),
      getAiProvider: getAiProviderMock.mockResolvedValue(aiProvider),
    });

    const result = await service.askLibraryForContext(
      { APP_NAME: "cloudmind-test" },
      {
        question: "What is the D1 Vectorize tradeoff?",
        topK: 2,
      },
      {
        profile: "coding",
        preferredDomains: ["engineering"],
        boostedDomains: ["engineering"],
        suppressedDomains: ["personal", "finance", "health"],
        includeSummaryOnly: true,
        overfetchMultiplier: 2,
        allowFallback: false,
      }
    );

    expect(result.answer).toContain("Vectorize");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.assetId).toBe("asset-stable-1");
    expect(result.resultScope).toBe("preferred_only");
  });

  it("askLibrary prefers query-relevant chunk sources over generic architecture notes", async () => {
    const repository = new QueryRelevanceSearchRepository();
    const vectorStore = new InMemoryVectorStore([
      {
        id: "architecture-1:0",
        score: 0.97,
      },
      {
        id: "honox-1:0",
        score: 0.95,
      },
    ]);
    const aiProvider: AIProvider = {
      createEmbeddings: vi.fn(async () => ({
        embeddings: [[0.19, 0.22, 0.27]],
      })),
      generateText: vi.fn(async () => ({
        text: "Use the HonoX monorepo notes for this decision [S1].",
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
        question: "Should CloudMind use monorepo or HonoX?",
        topK: 2,
      }
    );

    expect(result.sources).toEqual([
      {
        sourceType: "chunk",
        assetId: "asset-honox-1",
        chunkId: "chunk-honox-1",
        title: "HonoX Monorepo Notes",
        sourceUrl: null,
        snippet: "HonoX monorepo notes preview",
      },
    ]);
  });

  it("askLibraryForContext keeps answers inside preferred domains when fallback is disabled", async () => {
    const repository = new ContextRankingSearchRepository();
    const vectorStore = new InMemoryVectorStore([
      {
        id: "personal-1:0",
        score: 0.96,
      },
      {
        id: "engineering-1:0",
        score: 0.9,
      },
    ]);
    const aiProvider: AIProvider = {
      createEmbeddings: vi.fn(async () => ({
        embeddings: [[0.11, 0.22, 0.33]],
      })),
      generateText: vi.fn(async () => ({
        text: "Use the engineering guide first [S1].",
      })),
    };
    const service = createChatService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStore),
      getAiProvider: getAiProviderMock.mockResolvedValue(aiProvider),
    });

    const result = await service.askLibraryForContext(
      { APP_NAME: "cloudmind-test" },
      {
        question: "How should I debug this?",
        topK: 2,
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

    expect(aiProvider.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("[S1] Engineering Debugging Guide"),
      })
    );
    expect(result).toEqual({
      answer: "Use the engineering guide first [S1].",
      sources: [
        {
          sourceType: "chunk",
          assetId: "asset-engineering-1",
          chunkId: "engineering-chunk-1",
          title: "Engineering Debugging Guide",
          sourceUrl: null,
          snippet: "Engineering debugging guide",
        },
      ],
      indexingSummary: {
        matchedLayers: ["chunk"],
        domains: ["engineering"],
        documentClasses: [],
        sourceKinds: ["manual"],
        sourceHosts: [],
        collections: ["inbox:notes"],
        topics: [],
      },
      resultScope: "preferred_only",
    });
  });

  it("askLibraryForContext can include fallback sources when explicitly enabled", async () => {
    const repository = new ContextRankingSearchRepository();
    const vectorStore = new InMemoryVectorStore([
      {
        id: "personal-1:0",
        score: 0.96,
      },
      {
        id: "engineering-1:0",
        score: 0.9,
      },
    ]);
    const aiProvider: AIProvider = {
      createEmbeddings: vi.fn(async () => ({
        embeddings: [[0.11, 0.22, 0.33]],
      })),
      generateText: vi.fn(async () => ({
        text: "Use the engineering guide first [S1].",
      })),
    };
    const service = createChatService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
      getVectorStore: getVectorStoreMock.mockResolvedValue(vectorStore),
      getAiProvider: getAiProviderMock.mockResolvedValue(aiProvider),
    });

    const result = await service.askLibraryForContext(
      { APP_NAME: "cloudmind-test" },
      {
        question: "How should I debug this?",
        topK: 2,
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

    expect(result.sources).toHaveLength(2);
    expect(result.sources.map((source) => source.assetId)).toEqual([
      "asset-engineering-1",
      "asset-personal-1",
    ]);
    expect(result.indexingSummary).toEqual({
      matchedLayers: ["chunk"],
      domains: ["engineering", "personal"],
      documentClasses: [],
      sourceKinds: ["manual"],
      sourceHosts: [],
      collections: ["inbox:notes"],
      topics: [],
    });
    expect(result.resultScope).toBe("fallback_expanded");
  });

  it("askLibraryForContext refuses to answer when the remaining context is too weak", async () => {
    const repository = new WeakContextSearchRepository();
    const vectorStore = new InMemoryVectorStore([
      {
        id: "engineering-weak-1:0",
        score: 0.94,
      },
    ]);
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

    const result = await service.askLibraryForContext(
      { APP_NAME: "cloudmind-test" },
      {
        question: "How do descriptor facets drive browse navigation?",
        topK: 2,
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

    expect(result).toEqual({
      answer:
        "I could not find enough relevant context in your library to answer that yet.",
      sources: [],
      resultScope: "preferred_only",
    });
    expect(aiProvider.generateText).not.toHaveBeenCalled();
  });
});
