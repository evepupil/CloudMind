import { describe, expect, it } from "vitest";

import type {
  AIProvider,
  CreateEmbeddingsResult,
  GenerateTextResult,
} from "@/core/ai/ports";
import type { MemoryStatement } from "@/core/memory/ports";
import type { ExtractedStatement } from "@/features/memory/server/graph-extraction";
import {
  createReconcileJudge,
  parseReconcileDecision,
} from "@/features/memory/server/memory-reconcile";

const stmt = (id: string, nlText: string): MemoryStatement => ({
  id,
  scopeId: "default",
  subjectEntityId: "en1",
  predicate: "lives in",
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

const newStatement: ExtractedStatement = {
  subject: "Alice",
  predicate: "lives in",
  object: "Los Angeles",
  objectIsEntity: false,
  nlText: "Alice lives in Los Angeles",
  confidence: null,
};

// 仅实现 reconcile 用到的 generateText；createEmbeddings 返回空以满足接口。
class ScriptedAIProvider implements AIProvider {
  public calls = 0;

  public constructor(
    private readonly responder: () => string | Promise<string>
  ) {}

  public async generateText(): Promise<GenerateTextResult> {
    this.calls += 1;

    return { text: await this.responder() };
  }

  public async createEmbeddings(): Promise<CreateEmbeddingsResult> {
    return { embeddings: [] };
  }
}

describe("parseReconcileDecision", () => {
  const candidates = [stmt("st1", "Alice lives in New York")];

  it("parses ADD with null target", () => {
    expect(
      parseReconcileDecision('{"action":"ADD","target":null}', candidates)
    ).toEqual({ action: "ADD", targetStatementId: null });
  });

  it("parses NOOP", () => {
    expect(parseReconcileDecision('{"action":"NOOP"}', candidates)).toEqual({
      action: "NOOP",
      targetStatementId: null,
    });
  });

  it("maps UPDATE 1-based target to the candidate id", () => {
    expect(
      parseReconcileDecision('{"action":"UPDATE","target":1}', candidates)
    ).toEqual({ action: "UPDATE", targetStatementId: "st1" });
  });

  it("maps DELETE target and accepts lowercase action", () => {
    expect(
      parseReconcileDecision('{"action":"delete","target":1}', candidates)
    ).toEqual({ action: "DELETE", targetStatementId: "st1" });
  });

  it("strips <think> reasoning before parsing fenced json", () => {
    const raw =
      '<think>compare {a} vs {b}</think>\n```json\n{"action":"NOOP"}\n```';

    expect(parseReconcileDecision(raw, candidates)).toEqual({
      action: "NOOP",
      targetStatementId: null,
    });
  });

  it("returns null for UPDATE without a target (caller falls back to ADD)", () => {
    expect(
      parseReconcileDecision('{"action":"UPDATE"}', candidates)
    ).toBeNull();
  });

  it("returns null when the target index is out of range", () => {
    expect(
      parseReconcileDecision('{"action":"UPDATE","target":5}', candidates)
    ).toBeNull();
  });

  it("returns null for unknown actions and non-json", () => {
    expect(
      parseReconcileDecision('{"action":"MERGE","target":1}', candidates)
    ).toBeNull();
    expect(parseReconcileDecision("no json here", candidates)).toBeNull();
  });
});

describe("createReconcileJudge", () => {
  it("returns ADD without calling the model when there are no candidates", async () => {
    const ai = new ScriptedAIProvider(() => '{"action":"NOOP"}');
    const judge = createReconcileJudge(ai);

    const decision = await judge({ statement: newStatement, candidates: [] });

    expect(decision).toEqual({ action: "ADD", targetStatementId: null });
    expect(ai.calls).toBe(0);
  });

  it("returns the parsed decision when candidates exist", async () => {
    const ai = new ScriptedAIProvider(() => '{"action":"UPDATE","target":1}');
    const judge = createReconcileJudge(ai);

    const decision = await judge({
      statement: newStatement,
      candidates: [stmt("st9", "Alice lives in New York")],
    });

    expect(decision).toEqual({ action: "UPDATE", targetStatementId: "st9" });
    expect(ai.calls).toBe(1);
  });

  it("falls back to ADD when the model throws", async () => {
    const ai = new ScriptedAIProvider(() => {
      throw new Error("model down");
    });
    const judge = createReconcileJudge(ai);

    const decision = await judge({
      statement: newStatement,
      candidates: [stmt("st1", "Alice lives in New York")],
    });

    expect(decision).toEqual({ action: "ADD", targetStatementId: null });
  });

  it("falls back to ADD when the model returns garbage", async () => {
    const ai = new ScriptedAIProvider(() => "not json at all");
    const judge = createReconcileJudge(ai);

    const decision = await judge({
      statement: newStatement,
      candidates: [stmt("st1", "Alice lives in New York")],
    });

    expect(decision).toEqual({ action: "ADD", targetStatementId: null });
  });
});
