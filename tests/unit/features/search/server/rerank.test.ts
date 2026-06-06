import { describe, expect, it } from "vitest";

import type { AIProvider, RerankResult } from "@/core/ai/ports";
import type { EvidenceItem } from "@/features/search/model/evidence";
import {
  applyMmr,
  jaccardSimilarity,
  rerankEvidence,
  tokenizeForSimilarity,
} from "@/features/search/server/rerank";

const makeItem = (id: string, text: string, score: number): EvidenceItem =>
  ({
    id,
    layer: "chunk",
    score,
    text,
    snippet: text,
    matchReasons: [],
  }) as unknown as EvidenceItem;

describe("tokenizeForSimilarity", () => {
  it("extracts english words and CJK single chars", () => {
    const tokens = tokenizeForSimilarity("Vector search 向量检索");

    expect(tokens.has("vector")).toBe(true);
    expect(tokens.has("search")).toBe(true);
    expect(tokens.has("向")).toBe(true);
    expect(tokens.has("索")).toBe(true);
  });
});

describe("jaccardSimilarity", () => {
  it("is 1 for identical sets and 0 for disjoint", () => {
    expect(jaccardSimilarity(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
    expect(jaccardSimilarity(new Set(["a"]), new Set(["b"]))).toBe(0);
  });

  it("computes partial overlap", () => {
    expect(
      jaccardSimilarity(new Set(["a", "b"]), new Set(["a", "c"]))
    ).toBeCloseTo(1 / 3);
  });
});

describe("applyMmr", () => {
  it("pushes a near-duplicate behind a diverse lower-relevance item", () => {
    const entries = [
      { item: "A", relevance: 1, tokens: new Set(["x", "y", "z"]) },
      { item: "B", relevance: 0.95, tokens: new Set(["x", "y", "z"]) },
      { item: "C", relevance: 0.6, tokens: new Set(["p", "q", "r"]) },
    ];

    const ordered = applyMmr(entries, 0.7).map((entry) => entry.item);

    // A first (top relevance); then diverse C beats near-dup B despite B>C relevance.
    expect(ordered).toEqual(["A", "C", "B"]);
  });
});

describe("rerankEvidence", () => {
  const items = [
    makeItem("a", "alpha document about storage", 0.9),
    makeItem("b", "beta document about queues", 0.8),
    makeItem("c", "gamma document about vectors", 0.7),
  ];

  it("reorders by the reranker score (later docs scored higher)", async () => {
    const provider: Pick<AIProvider, "rerank"> = {
      rerank: async ({ documents }): Promise<RerankResult[]> =>
        documents.map((_, index) => ({ index, score: index })),
    };

    const result = await rerankEvidence(provider, "q", items);
    const [first, second] = result;

    expect(result.map((item) => item.id)).toEqual(["c", "b", "a"]);
    // scores become a strictly descending ramp.
    expect(first?.score ?? 0).toBeGreaterThan(second?.score ?? 0);
  });

  it("falls back to the original order when the reranker throws", async () => {
    const provider: Pick<AIProvider, "rerank"> = {
      rerank: async (): Promise<RerankResult[]> => {
        throw new Error("model unavailable");
      },
    };

    const result = await rerankEvidence(provider, "q", items);

    expect(result).toBe(items);
  });

  it("falls back when the reranker returns nothing", async () => {
    const provider: Pick<AIProvider, "rerank"> = {
      rerank: async (): Promise<RerankResult[]> => [],
    };

    expect(await rerankEvidence(provider, "q", items)).toBe(items);
  });

  it("passes through when the provider has no rerank capability", async () => {
    const result = await rerankEvidence({}, "q", items);

    expect(result).toBe(items);
  });
});
