import { describe, expect, it } from "vitest";

import type { AssetSummaryMatch } from "@/features/assets/model/types";
import { scoreAssetSummaryMatch } from "@/features/search/server/summary-scoring";

const match: AssetSummaryMatch = {
  asset: {
    id: "asset-1",
    type: "note",
    title: "检索记录",
    summary: "系统通过图谱做语义检索。",
    sourceUrl: null,
    sourceKind: "manual",
    status: "ready",
    domain: "engineering",
    aiVisibility: "summary_only",
    retrievalPriority: 0,
    recordKind: "library",
    scopeId: "personal",
    contextKey: "global",
    collectionKey: null,
    capturedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
  summary: "系统通过图谱做语义检索。",
};

describe("scoreAssetSummaryMatch", () => {
  it("matches continuous Chinese queries with CJK bigrams", () => {
    expect(scoreAssetSummaryMatch("检索图谱", match)).toBeGreaterThan(0.5);
  });
});
