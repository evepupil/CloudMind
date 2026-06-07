import { describe, expect, it } from "vitest";

import type { AIProvider } from "@/core/ai/ports";
import type {
  AssetSearchInput,
  AssetSearchRepository,
} from "@/core/assets/ports";
import type { MemoryRepository, MemoryStatement } from "@/core/memory/ports";
import type { VectorSearchMatch, VectorStore } from "@/core/vector/ports";
import type {
  AssetAiVisibility,
  AssetListResult,
  AssetSummary,
} from "@/features/assets/model/types";
import { createSearchService } from "@/features/search/server/service";

const graphStatement = (
  id: string,
  subjectEntityId: string,
  nlText: string
): MemoryStatement => ({
  id,
  scopeId: "default",
  subjectEntityId,
  predicate: "based in",
  objectEntityId: null,
  objectLiteral: null,
  nlText,
  confidence: null,
  importance: 0,
  validFrom: null,
  validUntil: null,
  createdAt: "t1",
  expiredAt: null,
  supersededById: null,
  lastAccessedAt: null,
  accessCount: 0,
});

const graphAsset = (
  id: string,
  aiVisibility: AssetAiVisibility
): AssetSummary => ({
  id,
  type: "note",
  title: "Acme Org",
  summary: "About Acme",
  sourceUrl: null,
  sourceKind: "manual",
  status: "ready",
  domain: "engineering",
  aiVisibility,
  retrievalPriority: 0,
  sourceHost: null,
  collectionKey: "inbox:notes",
  capturedAt: "2026-03-19T00:00:00.000Z",
  createdAt: "2026-03-19T00:00:00.000Z",
  updatedAt: "2026-03-19T00:00:00.000Z",
});

// 只产出图证据所需 hydration 的检索仓库：lexical/dense 通道均返回空。
class GraphOnlySearchRepository implements AssetSearchRepository {
  public constructor(private readonly summaries: AssetSummary[]) {}

  public async searchAssets(
    _input: AssetSearchInput
  ): Promise<AssetListResult> {
    return {
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    };
  }

  public async getChunkMatchesByVectorIds() {
    return [];
  }

  public async searchAssetSummaries() {
    return [];
  }

  public async getAssetSummariesByIds(ids: string[]): Promise<AssetSummary[]> {
    return this.summaries.filter((summary) => ids.includes(summary.id));
  }
}

// 部分实现的图记忆仓库（recallGraphStatements 只用其中 4 个读方法），转型为 MemoryRepository。
const graphMemoryRepository = (): MemoryRepository =>
  ({
    async findEntityIdsByVectorIds(vectorIds: string[]) {
      return vectorIds.includes("gv1")
        ? [{ vectorId: "gv1", entityId: "e1" }]
        : [];
    },
    async findActiveOutgoingEdges() {
      return [];
    },
    async findActiveStatementsBySubjects(subjectEntityIds: string[]) {
      return subjectEntityIds.includes("e1")
        ? [graphStatement("s1", "e1", "Acme is based in Berlin")]
        : [];
    },
    async findProvenanceByMemoryIds(_type: unknown, memoryIds: string[]) {
      return memoryIds.includes("s1")
        ? [
            {
              memoryId: "s1",
              assetId: "asset-graph-1",
              episodeId: null,
              chunkIndex: null,
            },
          ]
        : [];
    },
  }) as unknown as MemoryRepository;

const emptyStore: VectorStore = {
  async search() {
    return [];
  },
  async upsert() {},
  async deleteByIds() {},
};

const seedStore = (matches: VectorSearchMatch[]): VectorStore => ({
  async search() {
    return matches;
  },
  async upsert() {},
  async deleteByIds() {},
});

const aiProvider: AIProvider = {
  generateText: async () => ({ text: "" }),
  createEmbeddings: async () => ({ embeddings: [[0.11, 0.22, 0.33]] }),
};

const buildService = (assetVisibility: AssetAiVisibility) =>
  createSearchService({
    getAssetRepository: () =>
      new GraphOnlySearchRepository([
        graphAsset("asset-graph-1", assetVisibility),
      ]),
    getVectorStore: () => emptyStore,
    getAIProvider: () => aiProvider,
    getMemoryRepository: () => graphMemoryRepository(),
    getGraphVectorStore: () => seedStore([{ id: "gv1", score: 0.9 }]),
  });

describe("search service graph channel", () => {
  it("surfaces a graph statement as statement-layer evidence drilled to its L1 asset", async () => {
    const service = buildService("allow");

    const result = await service.searchAssets(undefined, {
      query: "where is acme based",
      page: 1,
      pageSize: 10,
    });

    const graphItems = result.evidence.items.filter(
      (item) => item.layer === "statement"
    );

    expect(graphItems).toHaveLength(1);
    expect(graphItems[0]).toMatchObject({
      text: "Acme is based in Berlin",
      asset: { id: "asset-graph-1" },
    });
    expect(graphItems[0]?.matchReasons[0]?.code).toBe("graph_match");
  });

  it("excludes graph facts whose asset is not aiVisibility=allow", async () => {
    const service = buildService("summary_only");

    const result = await service.searchAssets(undefined, {
      query: "where is acme based",
      page: 1,
      pageSize: 10,
    });

    expect(
      result.evidence.items.some((item) => item.layer === "statement")
    ).toBe(false);
  });
});
