import { describe, expect, it } from "vitest";

import type { AssetSummary } from "@/features/assets/model/types";
import type {
  EvidenceItem,
  EvidenceLayer,
} from "@/features/search/model/evidence";
import type { SearchResult } from "@/features/search/model/types";
import {
  mergeRecallResults,
  type PerQueryRecall,
} from "@/features/search/server/recall";

const asset = (over: Partial<AssetSummary> = {}): AssetSummary => ({
  id: "asset-1",
  type: "note",
  title: "Memory asset",
  summary: null,
  sourceUrl: null,
  sourceKind: "mcp",
  status: "ready",
  domain: "general",
  aiVisibility: "allow",
  retrievalPriority: 0,
  collectionKey: null,
  capturedAt: null,
  createdAt: "2026-06-07T00:00:00.000Z",
  updatedAt: "2026-06-07T00:00:00.000Z",
  ...over,
});

const evidenceItem = (
  id: string,
  layer: EvidenceLayer,
  a: AssetSummary,
  score: number,
  text: string,
  snippet: string
): EvidenceItem => ({
  id,
  layer,
  score,
  asset: a,
  source: {
    sourceUrl: a.sourceUrl,
    sourceKind: a.sourceKind,
    sourceHost: a.sourceHost ?? null,
    capturedAt: a.capturedAt,
  },
  indexing: {
    matchedLayer: layer,
    domain: a.domain,
    sourceHost: a.sourceHost ?? null,
    collectionKey: a.collectionKey,
    aiVisibility: a.aiVisibility,
    sourceKind: a.sourceKind,
  },
  visibility: { aiVisibility: a.aiVisibility },
  text,
  snippet,
  matchReasons: [],
});

// chunk 证据：id=chunk:<assetId>:<chunkIndex>，recall 取 snippet。
const chunkEv = (
  a: AssetSummary,
  chunkIndex: number,
  score: number,
  snippet: string
): EvidenceItem =>
  evidenceItem(
    `chunk:${a.id}:${chunkIndex}`,
    "chunk",
    a,
    score,
    `${snippet} full text`,
    snippet
  );

// summary 证据：id=summary:<assetId>，recall 取 text。
const summaryEv = (
  a: AssetSummary,
  score: number,
  text: string
): EvidenceItem =>
  evidenceItem(`summary:${a.id}`, "summary", a, score, text, text);

// statement 证据：id=statement:<stmtId>:<assetId>，recall 取 text。
const statementEv = (
  a: AssetSummary,
  statementId: string,
  score: number,
  text: string
): EvidenceItem =>
  evidenceItem(
    `statement:${statementId}:${a.id}`,
    "statement",
    a,
    score,
    text,
    text
  );

const perQuery = (query: string, items: EvidenceItem[]): PerQueryRecall => ({
  query,
  result: {
    items: [],
    evidence: { items },
    groupedEvidence: [],
    pagination: {
      page: 1,
      pageSize: 10,
      total: items.length,
      totalPages: 1,
    },
  } satisfies SearchResult,
});

describe("mergeRecallResults", () => {
  it("dedupes a chunk hit across sub-queries, keeping max score and merging matched queries", () => {
    const a = asset({ id: "asset-income" });
    const merged = mergeRecallResults(
      [
        perQuery("income", [chunkEv(a, 0, 0.6, "annual income ~500k")]),
        perQuery("cash flow", [chunkEv(a, 0, 0.8, "annual income ~500k")]),
      ],
      20
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.score).toBe(0.8);
    expect(merged[0]?.matchedQueries).toEqual(["income", "cash flow"]);
    expect(merged[0]?.assetId).toBe("asset-income");
    expect(merged[0]?.kind).toBe("chunk");
  });

  it("keeps different chunks of the same asset as distinct memories", () => {
    const a = asset({ id: "asset-x" });
    const merged = mergeRecallResults(
      [
        perQuery("q", [
          chunkEv(a, 0, 0.5, "first chunk"),
          chunkEv(a, 1, 0.4, "second chunk"),
        ]),
      ],
      20
    );

    expect(merged).toHaveLength(2);
  });

  it("keeps distinct L2 statements from the same asset as separate memories", () => {
    // 回归本次审查发现的真 bug：旧实现把同资产多条 statement 压成一条 summary 而互相吞掉。
    const a = asset({ id: "asset-person" });
    const merged = mergeRecallResults(
      [
        perQuery("about me", [
          statementEv(a, "s1", 0.7, "lives in Tokyo"),
          statementEv(a, "s2", 0.6, "works at Acme"),
          summaryEv(a, 0.4, "profile summary"),
        ]),
      ],
      20
    );

    expect(merged).toHaveLength(3);
    const snippets = merged.map((memory) => memory.snippet);
    expect(snippets).toContain("lives in Tokyo");
    expect(snippets).toContain("works at Acme");
    expect(snippets).toContain("profile summary");
    expect(merged.some((memory) => memory.kind === "statement")).toBe(true);
  });

  it("sorts by score descending and truncates to the limit", () => {
    const merged = mergeRecallResults(
      [
        perQuery("q", [
          chunkEv(asset({ id: "a" }), 0, 0.3, "low"),
          chunkEv(asset({ id: "b" }), 0, 0.9, "high"),
          chunkEv(asset({ id: "c" }), 0, 0.6, "mid"),
        ]),
      ],
      2
    );

    expect(merged.map((memory) => memory.assetId)).toEqual(["b", "c"]);
  });

  it("maps a summary memory using its full text", () => {
    const a = asset({ id: "asset-s", title: "Profile" });
    const merged = mergeRecallResults(
      [
        perQuery("q", [
          chunkEv(a, 0, 0.7, "chunk text"),
          summaryEv(a, 0.5, "summary text"),
        ]),
      ],
      20
    );

    expect(merged).toHaveLength(2);
    const summary = merged.find((memory) => memory.kind === "summary");
    expect(summary?.snippet).toBe("summary text");
  });

  it("retains the first-seen snippet even when a later sub-query scores higher", () => {
    const a = asset({ id: "asset-snip" });
    const merged = mergeRecallResults(
      [
        perQuery("A", [chunkEv(a, 0, 0.5, "old")]),
        perQuery("B", [chunkEv(a, 0, 0.9, "new")]),
      ],
      20
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.score).toBe(0.9);
    expect(merged[0]?.matchedQueries).toEqual(["A", "B"]);
    // 显式锁定「保留首见 snippet」语义。
    expect(merged[0]?.snippet).toBe("old");
  });

  it("keeps the earlier higher score when a later sub-query collides with a lower score", () => {
    const a = asset({ id: "asset-max" });
    const merged = mergeRecallResults(
      [
        perQuery("A", [chunkEv(a, 0, 0.9, "early high")]),
        perQuery("B", [chunkEv(a, 0, 0.4, "late low")]),
      ],
      20
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.score).toBe(0.9);
  });

  it("returns an empty bundle for a non-positive limit", () => {
    const a = asset({ id: "asset-empty" });
    const merged = mergeRecallResults(
      [perQuery("q", [chunkEv(a, 0, 0.5, "anything")])],
      0
    );

    expect(merged).toEqual([]);
  });

  it("includes the asset createdAt on each recalled memory", () => {
    const a = asset({ id: "asset-ts", createdAt: "2025-03-01T08:00:00.000Z" });
    const merged = mergeRecallResults(
      [perQuery("q", [chunkEv(a, 0, 0.5, "text")])],
      20
    );

    expect(merged[0]?.createdAt).toBe("2025-03-01T08:00:00.000Z");
  });

  it("orders by recency (newest createdAt first) when order is recency", () => {
    const old = asset({ id: "old", createdAt: "2025-01-01T00:00:00.000Z" });
    const recent = asset({
      id: "recent",
      createdAt: "2026-06-01T00:00:00.000Z",
    });
    const mid = asset({ id: "mid", createdAt: "2025-09-01T00:00:00.000Z" });
    const merged = mergeRecallResults(
      [
        perQuery("q", [
          // 分数与时间故意逆序，证明 recency 用时间而非分数排序。
          chunkEv(old, 0, 0.9, "old high score"),
          chunkEv(recent, 0, 0.3, "recent low score"),
          chunkEv(mid, 0, 0.6, "mid"),
        ]),
      ],
      20,
      "recency"
    );

    expect(merged.map((memory) => memory.assetId)).toEqual([
      "recent",
      "mid",
      "old",
    ]);
  });

  it("breaks recency ties by score", () => {
    const sameTime = "2026-06-07T00:00:00.000Z";
    const a = asset({ id: "a", createdAt: sameTime });
    const b = asset({ id: "b", createdAt: sameTime });
    const merged = mergeRecallResults(
      [
        perQuery("q", [
          chunkEv(a, 0, 0.4, "lower"),
          chunkEv(b, 0, 0.8, "higher"),
        ]),
      ],
      20,
      "recency"
    );

    expect(merged.map((memory) => memory.assetId)).toEqual(["b", "a"]);
  });

  it("defaults to relevance order (by score) when order is omitted", () => {
    const old = asset({ id: "old", createdAt: "2025-01-01T00:00:00.000Z" });
    const recent = asset({
      id: "recent",
      createdAt: "2026-06-01T00:00:00.000Z",
    });
    const merged = mergeRecallResults(
      [
        perQuery("q", [
          chunkEv(recent, 0, 0.3, "recent low"),
          chunkEv(old, 0, 0.9, "old high"),
        ]),
      ],
      20
    );

    // 默认 relevance：高分在前，无视时间。
    expect(merged.map((memory) => memory.assetId)).toEqual(["old", "recent"]);
  });
});
