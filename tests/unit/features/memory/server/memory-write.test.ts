import { describe, expect, it } from "vitest";

import type {
  AddProvenanceInput,
  CreateEdgeInput,
  CreateEpisodeInput,
  CreateStatementInput,
  MemoryEntity,
  MemoryRepository,
  UpsertEntityInput,
} from "@/core/memory/ports";
import {
  type ExtractedGraph,
  normalizeEntityName,
  parseExtractedGraph,
  parseGraphResponse,
} from "@/features/memory/server/graph-extraction";
import { writeGraphToMemory } from "@/features/memory/server/memory-write";

class FakeMemoryRepository implements MemoryRepository {
  public readonly entities = new Map<string, MemoryEntity>();
  public readonly statements: CreateStatementInput[] = [];
  public readonly edges: CreateEdgeInput[] = [];
  public readonly provenance: AddProvenanceInput[] = [];
  private seq = 0;

  public async createEpisode(
    _input: CreateEpisodeInput
  ): Promise<{ id: string }> {
    this.seq += 1;
    return { id: `ep${this.seq}` };
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
    this.statements.push(input);
    return { id: `st${this.seq}` };
  }

  public async createEdge(input: CreateEdgeInput): Promise<{ id: string }> {
    this.seq += 1;
    this.edges.push(input);
    return { id: `ed${this.seq}` };
  }

  public async addProvenance(input: AddProvenanceInput): Promise<void> {
    this.provenance.push(input);
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
