import { describe, expect, it } from "vitest";

import type {
  AddProvenanceInput,
  CreateEdgeInput,
  CreateEpisodeInput,
  CreateStatementInput,
  EntityVectorRef,
  InvalidateEdgesInput,
  InvalidateStatementInput,
  MemoryEdge,
  MemoryEntity,
  MemoryKind,
  MemoryProvenanceRef,
  MemoryRepository,
  MemoryStatement,
  UpsertEntityInput,
} from "@/core/memory/ports";
import {
  type ExtractedGraph,
  normalizeEntityName,
  parseExtractedGraph,
  parseGraphResponse,
} from "@/features/memory/server/graph-extraction";
import type { ReconcileJudge } from "@/features/memory/server/memory-reconcile";
import { writeGraphToMemory } from "@/features/memory/server/memory-write";

class FakeMemoryRepository implements MemoryRepository {
  public readonly entities = new Map<string, MemoryEntity>();
  public readonly statements: CreateStatementInput[] = [];
  // 完整陈述记录（带 id / expired_at），供调和读侧方法操作；按插入顺序保留。
  public readonly statementRecords = new Map<string, MemoryStatement>();
  public readonly edges: Array<
    CreateEdgeInput & { id: string; expired: boolean }
  > = [];
  public readonly provenance: AddProvenanceInput[] = [];
  public readonly vectorUpdates = new Map<string, string>();
  private seq = 0;

  public async createEpisode(
    _input: CreateEpisodeInput
  ): Promise<{ id: string }> {
    this.seq += 1;
    return { id: `ep${this.seq}` };
  }

  public async getEntityByVectorId(
    _vectorId: string
  ): Promise<MemoryEntity | null> {
    return null;
  }

  public async setEntityVectorId(
    entityId: string,
    vectorId: string
  ): Promise<void> {
    this.vectorUpdates.set(entityId, vectorId);
  }

  public async upsertEntityByNormalizedName(
    input: UpsertEntityInput
  ): Promise<MemoryEntity> {
    const scopeId = input.scopeId ?? "default";
    const key = `${scopeId}:${input.normalizedName}`;
    const found = this.entities.get(key);

    if (found) {
      found.mentionCount += 1;
      return { ...found };
    }

    this.seq += 1;
    const entity: MemoryEntity = {
      id: `en${this.seq}`,
      scopeId,
      canonicalName: input.canonicalName,
      normalizedName: input.normalizedName,
      type: input.type ?? null,
      mentionCount: 1,
    };
    this.entities.set(key, entity);

    return { ...entity };
  }

  public async createStatement(
    input: CreateStatementInput
  ): Promise<{ id: string }> {
    this.seq += 1;
    const id = `st${this.seq}`;
    this.statements.push(input);
    this.statementRecords.set(id, {
      id,
      scopeId: input.scopeId ?? "default",
      subjectEntityId: input.subjectEntityId,
      predicate: input.predicate,
      objectEntityId: input.objectEntityId ?? null,
      objectLiteral: input.objectLiteral ?? null,
      nlText: input.nlText,
      confidence: input.confidence ?? null,
      importance: input.importance ?? 0,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
      createdAt: `t${this.seq}`,
      expiredAt: null,
      supersededById: null,
      lastAccessedAt: null,
      accessCount: 0,
    });
    return { id };
  }

  public async findActiveStatementsBySubject(
    subjectEntityId: string,
    scopeId?: string | undefined
  ): Promise<MemoryStatement[]> {
    const scope = scopeId ?? "default";

    return [...this.statementRecords.values()].filter(
      (statement) =>
        statement.scopeId === scope &&
        statement.subjectEntityId === subjectEntityId &&
        statement.expiredAt === null
    );
  }

  public async getStatementById(
    statementId: string
  ): Promise<MemoryStatement | null> {
    return this.statementRecords.get(statementId) ?? null;
  }

  public async invalidateStatement(
    input: InvalidateStatementInput
  ): Promise<void> {
    const found = this.statementRecords.get(input.statementId);

    if (found) {
      this.seq += 1;
      found.expiredAt = `t${this.seq}`;
      found.supersededById = input.supersededById ?? null;
    }
  }

  public async bumpStatementAccess(statementIds: string[]): Promise<void> {
    for (const id of statementIds) {
      const found = this.statementRecords.get(id);

      if (found) {
        this.seq += 1;
        found.accessCount += 1;
        found.lastAccessedAt = `t${this.seq}`;
      }
    }
  }

  public async createEdge(input: CreateEdgeInput): Promise<{ id: string }> {
    this.seq += 1;
    const id = `ed${this.seq}`;
    this.edges.push({ ...input, id, expired: false });
    return { id };
  }

  public async invalidateActiveEdges(
    input: InvalidateEdgesInput
  ): Promise<void> {
    const scope = input.scopeId ?? "default";

    for (const edge of this.edges) {
      if (
        !edge.expired &&
        (edge.scopeId ?? "default") === scope &&
        edge.srcEntityId === input.srcEntityId &&
        edge.dstEntityId === input.dstEntityId &&
        edge.relation === input.relation
      ) {
        edge.expired = true;
      }
    }
  }

  public async addProvenance(input: AddProvenanceInput): Promise<void> {
    this.provenance.push(input);
  }

  public async findEntityIdsByVectorIds(
    vectorIds: string[]
  ): Promise<EntityVectorRef[]> {
    const wanted = new Set(vectorIds);

    return [...this.vectorUpdates.entries()].flatMap(([entityId, vectorId]) =>
      wanted.has(vectorId) ? [{ vectorId, entityId }] : []
    );
  }

  public async findActiveOutgoingEdges(
    _srcEntityIds: string[],
    _scopeId?: string | undefined
  ): Promise<MemoryEdge[]> {
    // 该 fake 的 edges 不带 id/expired，图遍历在 graph-recall 专用 fake 中测试。
    return [];
  }

  public async findActiveStatementsBySubjects(
    subjectEntityIds: string[],
    scopeId?: string | undefined
  ): Promise<MemoryStatement[]> {
    const scope = scopeId ?? "default";
    const subjects = new Set(subjectEntityIds);

    return [...this.statementRecords.values()].filter(
      (statement) =>
        statement.scopeId === scope &&
        subjects.has(statement.subjectEntityId) &&
        statement.expiredAt === null
    );
  }

  public async findProvenanceByMemoryIds(
    memoryType: MemoryKind,
    memoryIds: string[]
  ): Promise<MemoryProvenanceRef[]> {
    const wanted = new Set(memoryIds);

    return this.provenance
      .filter(
        (entry) => entry.memoryType === memoryType && wanted.has(entry.memoryId)
      )
      .map((entry) => ({
        memoryId: entry.memoryId,
        assetId: entry.assetId ?? null,
        episodeId: entry.episodeId ?? null,
        chunkIndex: entry.chunkIndex ?? null,
      }));
  }
}

describe("normalizeEntityName", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeEntityName("  Alice   Smith ")).toBe("alice smith");
    expect(normalizeEntityName("OpenAI")).toBe("openai");
  });
});

describe("parseExtractedGraph", () => {
  it("maps a valid graph and defaults object_is_entity to false", () => {
    const graph = parseExtractedGraph({
      entities: [{ name: "Alice", type: "person" }],
      statements: [{ subject: "Alice", predicate: "likes", object: "coffee" }],
    });

    expect(graph).not.toBeNull();
    expect(graph?.entities).toEqual([{ name: "Alice", type: "person" }]);
    expect(graph?.statements[0]).toMatchObject({
      objectIsEntity: false,
      nlText: "Alice likes coffee",
      confidence: null,
    });
  });

  it("tolerates an empty object (both arrays optional)", () => {
    expect(parseExtractedGraph({})).toEqual({ entities: [], statements: [] });
  });

  it("returns null on invalid shape", () => {
    expect(parseExtractedGraph({ entities: [{ type: "person" }] })).toBeNull();
  });
});

describe("parseGraphResponse", () => {
  it("strips <think> reasoning containing braces before parsing fenced json", () => {
    const raw =
      '<think>The subject { is } D1</think>\n```json\n{"entities":[{"name":"D1","type":"product"}],"statements":[]}\n```';

    expect(parseGraphResponse(raw)?.entities).toEqual([
      { name: "D1", type: "product" },
    ]);
  });

  it("parses raw json after stripping reasoning", () => {
    const raw =
      '<think>blah {x}</think> {"entities":[{"name":"Acme"}],"statements":[]}';

    expect(parseGraphResponse(raw)?.entities).toEqual([
      { name: "Acme", type: null },
    ]);
  });

  it("returns null when there is no json payload", () => {
    expect(parseGraphResponse("<think>only reasoning</think>")).toBeNull();
    expect(parseGraphResponse("no json here")).toBeNull();
  });

  it("extracts only the first balanced object when the model repeats it", () => {
    const raw =
      '{"entities":[{"name":"D1"}],"statements":[]}\n\n{"entities":[{"name":"X"}],"statements":[]}';

    expect(parseGraphResponse(raw)?.entities).toEqual([
      { name: "D1", type: null },
    ]);
  });

  it("handles prose continuation before the json (qwen completion style)", () => {
    const raw =
      'Bob uses Notion.\n\nAssistant: \n\n{"entities":[{"name":"Alice","type":"person"}],"statements":[]}\n\n{"entities":[]}';

    expect(parseGraphResponse(raw)?.entities).toEqual([
      { name: "Alice", type: "person" },
    ]);
  });
});

describe("writeGraphToMemory", () => {
  it("writes entities, a statement, an edge, and provenance for entity objects", async () => {
    const repo = new FakeMemoryRepository();
    const graph: ExtractedGraph = {
      entities: [
        { name: "Alice", type: "person" },
        { name: "Acme", type: "org" },
      ],
      statements: [
        {
          subject: "Alice",
          predicate: "works at",
          object: "Acme",
          objectIsEntity: true,
          nlText: "Alice works at Acme",
          confidence: 0.9,
        },
      ],
    };

    const result = await writeGraphToMemory(repo, { assetId: "a1" }, graph);

    expect(result).toEqual({
      entityCount: 2,
      statementCount: 1,
      edgeCount: 1,
    });
    expect(repo.statements[0]).toMatchObject({
      predicate: "works at",
      objectLiteral: null,
    });
    expect(repo.statements[0]?.objectEntityId).toBeTruthy();
    expect(repo.edges[0]).toMatchObject({ relation: "works at" });
    // statement + edge each get a provenance row back to the asset.
    expect(repo.provenance).toHaveLength(2);
    expect(repo.provenance.every((p) => p.assetId === "a1")).toBe(true);
  });

  it("stores literal objects without an edge", async () => {
    const repo = new FakeMemoryRepository();
    const graph: ExtractedGraph = {
      entities: [{ name: "Alice", type: "person" }],
      statements: [
        {
          subject: "Alice",
          predicate: "likes",
          object: "coffee",
          objectIsEntity: false,
          nlText: "Alice likes coffee",
          confidence: null,
        },
      ],
    };

    const result = await writeGraphToMemory(repo, { assetId: "a1" }, graph);

    expect(result.edgeCount).toBe(0);
    expect(repo.edges).toHaveLength(0);
    expect(repo.statements[0]).toMatchObject({
      objectEntityId: null,
      objectLiteral: "coffee",
    });
  });

  it("deduplicates entities by normalized name across ingestions", async () => {
    const repo = new FakeMemoryRepository();
    const makeGraph = (subject: string): ExtractedGraph => ({
      entities: [{ name: "Alice", type: "person" }],
      statements: [
        {
          subject,
          predicate: "likes",
          object: "tea",
          objectIsEntity: false,
          nlText: `${subject} likes tea`,
          confidence: null,
        },
      ],
    });

    // 两次摄取（不同大小写/空白的同一实体）应折叠为一个实体，mention_count 累加。
    await writeGraphToMemory(repo, { assetId: "a1" }, makeGraph("Alice"));
    await writeGraphToMemory(repo, { assetId: "a2" }, makeGraph("  alice "));

    expect(repo.entities.size).toBe(1);
    const [entity] = [...repo.entities.values()];
    expect(entity?.mentionCount).toBe(2);
    expect(repo.statements).toHaveLength(2);
  });
});

describe("writeGraphToMemory reconciliation", () => {
  // 同一主语不同城市的两次摄取，用于验证 ADD/UPDATE/DELETE/NOOP 调和分支。
  const livesIn = (city: string): ExtractedGraph => ({
    entities: [{ name: "Alice", type: "person" }],
    statements: [
      {
        subject: "Alice",
        predicate: "lives in",
        object: city,
        objectIsEntity: false,
        nlText: `Alice lives in ${city}`,
        confidence: null,
      },
    ],
  });

  const decide =
    (judge: ReconcileJudge): ReconcileJudge =>
    (input) =>
      judge(input);

  it("does not consult the judge when there are no candidates (first write = ADD)", async () => {
    const repo = new FakeMemoryRepository();
    let calls = 0;

    await writeGraphToMemory(repo, { assetId: "a1" }, livesIn("New York"), {
      reconcile: decide(async () => {
        calls += 1;
        return { action: "NOOP", targetStatementId: null };
      }),
    });

    expect(calls).toBe(0);
    expect(repo.statementRecords.size).toBe(1);
  });

  it("UPDATE invalidates the old statement and links superseded_by to the new one", async () => {
    const repo = new FakeMemoryRepository();
    await writeGraphToMemory(repo, { assetId: "a1" }, livesIn("New York"));

    await writeGraphToMemory(repo, { assetId: "a2" }, livesIn("Los Angeles"), {
      reconcile: decide(async ({ candidates }) => ({
        action: "UPDATE",
        targetStatementId: candidates[0]?.id ?? null,
      })),
    });

    const records = [...repo.statementRecords.values()];
    expect(records).toHaveLength(2);
    const [oldStatement, freshStatement] = records;
    expect(oldStatement?.expiredAt).not.toBeNull();
    expect(oldStatement?.supersededById).toBe(freshStatement?.id);
    expect(freshStatement?.expiredAt).toBeNull();
    expect(freshStatement?.objectLiteral).toBe("Los Angeles");
  });

  it("DELETE invalidates the conflicting statement without storing a new one", async () => {
    const repo = new FakeMemoryRepository();
    await writeGraphToMemory(repo, { assetId: "a1" }, livesIn("New York"));

    const result = await writeGraphToMemory(
      repo,
      { assetId: "a2" },
      livesIn("Los Angeles"),
      {
        reconcile: decide(async ({ candidates }) => ({
          action: "DELETE",
          targetStatementId: candidates[0]?.id ?? null,
        })),
      }
    );

    expect(result.statementCount).toBe(0);
    const records = [...repo.statementRecords.values()];
    expect(records).toHaveLength(1);
    expect(records[0]?.expiredAt).not.toBeNull();
    expect(records[0]?.supersededById).toBeNull();
  });

  it("NOOP leaves the existing statement untouched and writes nothing", async () => {
    const repo = new FakeMemoryRepository();
    await writeGraphToMemory(repo, { assetId: "a1" }, livesIn("New York"));

    const result = await writeGraphToMemory(
      repo,
      { assetId: "a2" },
      livesIn("New York"),
      {
        reconcile: decide(async () => ({
          action: "NOOP",
          targetStatementId: null,
        })),
      }
    );

    expect(result.statementCount).toBe(0);
    const records = [...repo.statementRecords.values()];
    expect(records).toHaveLength(1);
    expect(records[0]?.expiredAt).toBeNull();
  });

  // 实体宾语版本：会落一条 statement + 一条 edge，用于验证调和时 edge 同步失效。
  const livesInEntity = (city: string): ExtractedGraph => ({
    entities: [
      { name: "Alice", type: "person" },
      { name: city, type: "place" },
    ],
    statements: [
      {
        subject: "Alice",
        predicate: "lives in",
        object: city,
        objectIsEntity: true,
        nlText: `Alice lives in ${city}`,
        confidence: null,
      },
    ],
  });

  it("UPDATE also invalidates the superseded statement's edge", async () => {
    const repo = new FakeMemoryRepository();
    await writeGraphToMemory(
      repo,
      { assetId: "a1" },
      livesInEntity("New York")
    );

    await writeGraphToMemory(
      repo,
      { assetId: "a2" },
      livesInEntity("Los Angeles"),
      {
        reconcile: decide(async ({ candidates }) => ({
          action: "UPDATE",
          targetStatementId: candidates[0]?.id ?? null,
        })),
      }
    );

    // 旧边（lives in New York）失效，新边（lives in Los Angeles）仍活跃。
    expect(repo.edges).toHaveLength(2);
    const active = repo.edges.filter((edge) => !edge.expired);
    const expired = repo.edges.filter((edge) => edge.expired);
    expect(active).toHaveLength(1);
    expect(expired).toHaveLength(1);
    expect(active[0]?.dstEntityId).toBe(
      repo.entities.get("default:los angeles")?.id
    );
    expect(expired[0]?.dstEntityId).toBe(
      repo.entities.get("default:new york")?.id
    );
  });

  it("DELETE invalidates the conflicting statement's edge without adding a new one", async () => {
    const repo = new FakeMemoryRepository();
    await writeGraphToMemory(
      repo,
      { assetId: "a1" },
      livesInEntity("New York")
    );

    await writeGraphToMemory(
      repo,
      { assetId: "a2" },
      livesInEntity("Los Angeles"),
      {
        reconcile: decide(async ({ candidates }) => ({
          action: "DELETE",
          targetStatementId: candidates[0]?.id ?? null,
        })),
      }
    );

    // DELETE 在创建新 statement/edge 前就 continue：只有旧边，且已失效。
    expect(repo.edges).toHaveLength(1);
    expect(repo.edges[0]?.expired).toBe(true);
  });
});
