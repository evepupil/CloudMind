import { describe, expect, it } from "vitest";

import type {
  EntityVectorRef,
  MemoryEdge,
  MemoryKind,
  MemoryProvenanceRef,
  MemoryStatement,
} from "@/core/memory/ports";
import type {
  VectorSearchInput,
  VectorSearchMatch,
  VectorStore,
} from "@/core/vector/ports";
import {
  type GraphRecallRepository,
  recallGraphStatements,
} from "@/features/memory/server/graph-recall";

const statement = (
  id: string,
  subjectEntityId: string,
  nlText: string
): MemoryStatement => ({
  id,
  scopeId: "default",
  subjectEntityId,
  predicate: "rel",
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

const edge = (
  id: string,
  srcEntityId: string,
  dstEntityId: string
): MemoryEdge => ({
  id,
  scopeId: "default",
  srcEntityId,
  dstEntityId,
  relation: "rel",
});

// 固定图：e1 --works_at--> e2 --located_in--> e3。
const ENTITY_BY_VECTOR: Record<string, string> = { v1: "e1", v2: "e2" };
const EDGES: MemoryEdge[] = [edge("ed1", "e1", "e2"), edge("ed2", "e2", "e3")];
const STATEMENTS: Record<string, MemoryStatement> = {
  e1: statement("s1", "e1", "Alice works at Acme"),
  e2: statement("s2", "e2", "Acme located in NYC"),
  e3: statement("s3", "e3", "NYC is large"),
};
const PROVENANCE: Record<string, string> = { s1: "a1", s2: "a2", s3: "a3" };

class FakeGraphRepository implements GraphRecallRepository {
  // 记录种子映射收到的 scopeId，断言 scope 隔离一路下推到仓储层。
  public lastFindScopeId: string | undefined;

  public async findEntityIdsByVectorIds(
    vectorIds: string[],
    scopeId?: string
  ): Promise<EntityVectorRef[]> {
    this.lastFindScopeId = scopeId;
    return vectorIds.flatMap((vectorId) => {
      const entityId = ENTITY_BY_VECTOR[vectorId];
      return entityId ? [{ vectorId, entityId }] : [];
    });
  }

  public async findActiveOutgoingEdges(
    srcEntityIds: string[]
  ): Promise<MemoryEdge[]> {
    const src = new Set(srcEntityIds);
    return EDGES.filter((candidate) => src.has(candidate.srcEntityId));
  }

  public async findActiveStatementsBySubjects(
    subjectEntityIds: string[]
  ): Promise<MemoryStatement[]> {
    return subjectEntityIds.flatMap((entityId) => {
      const found = STATEMENTS[entityId];
      return found ? [found] : [];
    });
  }

  public async findProvenanceByMemoryIds(
    _memoryType: MemoryKind,
    memoryIds: string[]
  ): Promise<MemoryProvenanceRef[]> {
    return memoryIds.flatMap((memoryId) => {
      const assetId = PROVENANCE[memoryId];
      return assetId
        ? [{ memoryId, assetId, episodeId: null, chunkIndex: null }]
        : [];
    });
  }
}

class FakeGraphVectorStore implements VectorStore {
  // 捕获最近一次种子检索入参，断言 scope 过滤已下推到向量库。
  public lastSearchInput: VectorSearchInput | undefined;

  public constructor(private readonly matches: VectorSearchMatch[]) {}

  public async search(input: VectorSearchInput): Promise<VectorSearchMatch[]> {
    this.lastSearchInput = input;
    return this.matches;
  }

  public async upsert(): Promise<void> {}
  public async deleteByIds(): Promise<void> {}
}

describe("recallGraphStatements", () => {
  const repository = new FakeGraphRepository();

  it("expands seed entity across hops and scores by decay", async () => {
    const hits = await recallGraphStatements({
      queryVector: [0.1, 0.2],
      repository,
      graphVectorStore: new FakeGraphVectorStore([{ id: "v1", score: 0.9 }]),
      options: { maxHops: 2, hopDecay: 0.5 },
    });

    expect(hits.map((hit) => hit.statement.id)).toEqual(["s1", "s2", "s3"]);
    expect(hits[0]).toMatchObject({ score: 0.9, hops: 0, assetId: "a1" });
    expect(hits[1]).toMatchObject({ score: 0.45, hops: 1, assetId: "a2" });
    expect(hits[2]).toMatchObject({ hops: 2, assetId: "a3" });
    // 关联越远分数越低。
    expect(hits[0]?.score ?? 0).toBeGreaterThan(hits[1]?.score ?? 0);
    expect(hits[1]?.score ?? 0).toBeGreaterThan(hits[2]?.score ?? 0);
  });

  it("respects maxHops (depth 1 stops before the third entity)", async () => {
    const hits = await recallGraphStatements({
      queryVector: [0.1, 0.2],
      repository,
      graphVectorStore: new FakeGraphVectorStore([{ id: "v1", score: 0.9 }]),
      options: { maxHops: 1 },
    });

    expect(hits.map((hit) => hit.statement.id)).toEqual(["s1", "s2"]);
  });

  it("returns nothing when there are no seed matches", async () => {
    const hits = await recallGraphStatements({
      queryVector: [0.1, 0.2],
      repository,
      graphVectorStore: new FakeGraphVectorStore([]),
    });

    expect(hits).toEqual([]);
  });

  it("returns nothing for an empty query vector without touching the store", async () => {
    let searched = false;
    const store: VectorStore = {
      async search() {
        searched = true;
        return [];
      },
      async upsert() {},
      async deleteByIds() {},
    };

    const hits = await recallGraphStatements({
      queryVector: [],
      repository,
      graphVectorStore: store,
    });

    expect(hits).toEqual([]);
    expect(searched).toBe(false);
  });

  it("caps results at maxStatements", async () => {
    const hits = await recallGraphStatements({
      queryVector: [0.1, 0.2],
      repository,
      graphVectorStore: new FakeGraphVectorStore([{ id: "v1", score: 0.9 }]),
      options: { maxHops: 2, maxStatements: 2 },
    });

    expect(hits).toHaveLength(2);
    expect(hits.map((hit) => hit.statement.id)).toEqual(["s1", "s2"]);
  });

  // 二期 scope 隔离回归：图检索的 ANN 种子必须把 scope 过滤下推到 graph_entities 向量库，
  // 并把同一 scope 透传给仓储的实体反查；否则 personal 召回会混入 agent 实体（反之亦然）。
  it("种子检索默认把 personal scope 下推到向量库与仓储", async () => {
    const store = new FakeGraphVectorStore([{ id: "v1", score: 0.9 }]);
    const repo = new FakeGraphRepository();

    await recallGraphStatements({
      queryVector: [0.1, 0.2],
      repository: repo,
      graphVectorStore: store,
    });

    expect(store.lastSearchInput?.filter).toEqual({
      scopeId: { $eq: "personal" },
    });
    expect(repo.lastFindScopeId).toBe("personal");
  });

  it("种子检索传 scopeId=agent 时按 agent 过滤并透传", async () => {
    const store = new FakeGraphVectorStore([{ id: "v1", score: 0.9 }]);
    const repo = new FakeGraphRepository();

    await recallGraphStatements({
      queryVector: [0.1, 0.2],
      repository: repo,
      graphVectorStore: store,
      scopeId: "agent",
    });

    expect(store.lastSearchInput?.filter).toEqual({
      scopeId: { $eq: "agent" },
    });
    expect(repo.lastFindScopeId).toBe("agent");
  });
});
