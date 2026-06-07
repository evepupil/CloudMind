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
  relation: string
): MemoryEdge => ({
  id,
  scopeId: "default",
  srcEntityId,
  dstEntityId,
  relation,
});

// 预置「检测结果」的 stub，专门隔离 runMemoryRepair 的编排逻辑（去重端点 / 失效调用 / 计数）。
class RepairStub implements RepairRepository {
  public readonly invalidatedEdges: InvalidateEdgesInput[] = [];
  public readonly invalidatedStatements: InvalidateStatementInput[] = [];

  public constructor(
    private readonly drifted: MemoryEdge[],
    private readonly duplicates: DuplicateStatementRef[]
  ) {}

  public async findDriftedEdges(): Promise<MemoryEdge[]> {
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
        scopeId: undefined,
        srcEntityId: "alice",
        dstEntityId: "ny",
        relation: "lives in",
      },
      {
        scopeId: undefined,
        srcEntityId: "bob",
        dstEntityId: "paris",
        relation: "lives in",
      },
    ]);
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
  it("wraps the repair report", async () => {
    const repo = new RepairStub([edge("e1", "a", "b", "r")], []);

    const report = await runSleepTimeMaintenance(repo);

    expect(report.repair.driftedEdgesRepaired).toBe(1);
  });
});
