import { describe, expect, it } from "vitest";

import type {
  DuplicateStatementRef,
  InvalidateEdgesInput,
  InvalidateStatementInput,
  MemoryEdge,
} from "@/core/memory/ports";
import {
  type RepairRepository,
  runMemoryRepair,
  runSleepTimeMaintenance,
} from "@/features/memory/server/sleep-time";

const edge = (
  id: string,
  srcEntityId: string,
  dstEntityId: string,
  relation: string,
  overrides: Partial<
    Pick<MemoryEdge, "scopeId" | "contextKey" | "recordKind">
  > = {}
): MemoryEdge => ({
  id,
  scopeId: "default",
  contextKey: "global",
  recordKind: "library",
  srcEntityId,
  dstEntityId,
  relation,
  ...overrides,
});

// 预置「检测结果」的 stub，专门隔离 runMemoryRepair 的编排逻辑（去重端点 / 失效调用 / 计数）。
class RepairStub implements RepairRepository {
  public readonly invalidatedEdges: InvalidateEdgesInput[] = [];
  public readonly invalidatedStatements: InvalidateStatementInput[] = [];
  public readonly queriedScopes: Array<string | undefined> = [];

  public constructor(
    private readonly drifted: MemoryEdge[],
    private readonly duplicates: DuplicateStatementRef[]
  ) {}

  public async findDriftedEdges(scopeId?: string): Promise<MemoryEdge[]> {
    this.queriedScopes.push(scopeId);
    return this.drifted;
  }

  public async invalidateActiveEdges(
    input: InvalidateEdgesInput
  ): Promise<void> {
    this.invalidatedEdges.push(input);
  }

  public async findDuplicateActiveStatements(): Promise<
    DuplicateStatementRef[]
  > {
    return this.duplicates;
  }

  public async invalidateStatement(
    input: InvalidateStatementInput
  ): Promise<void> {
    this.invalidatedStatements.push(input);
  }
}

describe("runMemoryRepair", () => {
  it("invalidates drifted edges, collapsing duplicate endpoints to one call", async () => {
    const repo = new RepairStub(
      [
        edge("e1", "alice", "ny", "lives in"),
        edge("e2", "alice", "ny", "lives in"), // 同端点重复边
        edge("e3", "bob", "paris", "lives in"),
      ],
      []
    );

    const report = await runMemoryRepair(repo);

    // 报告按漂移边行数计；失效调用按端点去重（2 个端点）。
    expect(report.driftedEdgesRepaired).toBe(3);
    expect(repo.invalidatedEdges).toHaveLength(2);
    expect(repo.invalidatedEdges).toEqual([
      {
        scopeId: "default",
        contextKey: "global",
        recordKind: "library",
        srcEntityId: "alice",
        dstEntityId: "ny",
        relation: "lives in",
      },
      {
        scopeId: "default",
        contextKey: "global",
        recordKind: "library",
        srcEntityId: "bob",
        dstEntityId: "paris",
        relation: "lives in",
      },
    ]);
  });

  it("keeps identical endpoints isolated by scope, context, and record kind", async () => {
    const repo = new RepairStub(
      [
        edge("e1", "milestone", "m1", "tracks", {
          scopeId: "personal",
          contextKey: "project:github:team/alpha",
          recordKind: "memory",
        }),
        edge("e2", "milestone", "m1", "tracks", {
          scopeId: "personal",
          contextKey: "project:github:team/beta",
          recordKind: "memory",
        }),
        edge("e3", "milestone", "m1", "tracks", {
          scopeId: "personal",
          contextKey: "project:github:team/alpha",
          recordKind: "library",
        }),
      ],
      []
    );

    await runMemoryRepair(repo, "personal");

    expect(repo.invalidatedEdges).toHaveLength(3);
    expect(repo.invalidatedEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contextKey: "project:github:team/alpha",
          recordKind: "memory",
        }),
        expect.objectContaining({
          contextKey: "project:github:team/beta",
          recordKind: "memory",
        }),
        expect.objectContaining({
          contextKey: "project:github:team/alpha",
          recordKind: "library",
        }),
      ])
    );
  });

  it("archives each duplicate statement superseded by its retain target", async () => {
    const repo = new RepairStub(
      [],
      [
        { duplicateId: "d1", retainId: "r1" },
        { duplicateId: "d2", retainId: "r1" },
      ]
    );

    const report = await runMemoryRepair(repo);

    expect(report.duplicateStatementsArchived).toBe(2);
    expect(repo.invalidatedStatements).toEqual([
      { statementId: "d1", supersededById: "r1" },
      { statementId: "d2", supersededById: "r1" },
    ]);
  });

  it("is a no-op on a clean graph", async () => {
    const repo = new RepairStub([], []);

    const report = await runMemoryRepair(repo);

    expect(report).toEqual({
      driftedEdgesRepaired: 0,
      duplicateStatementsArchived: 0,
    });
    expect(repo.invalidatedEdges).toHaveLength(0);
    expect(repo.invalidatedStatements).toHaveLength(0);
  });
});

describe("runSleepTimeMaintenance", () => {
  it("repairs personal and agent scopes and merges the report", async () => {
    const repo = new RepairStub([edge("e1", "a", "b", "r")], []);

    const report = await runSleepTimeMaintenance(repo);

    expect(report.repair.driftedEdgesRepaired).toBe(2);
    expect(repo.queriedScopes).toEqual(["personal", "agent"]);
  });
});
