import { describe, expect, it } from "vitest";

import type { EvidenceItem } from "@/features/search/model/evidence";
import { buildGroupedEvidence } from "@/features/search/server/evidence";

const createEvidenceItem = (
  overrides: Partial<EvidenceItem> = {}
): EvidenceItem => {
  const asset = {
    id: "asset-1",
    type: "note" as const,
    title: "CloudMind Note",
    summary: "Summary",
    sourceUrl: null,
    sourceKind: "manual" as const,
    status: "ready" as const,
    domain: "engineering" as const,
    sensitivity: "internal" as const,
    aiVisibility: "allow" as const,
    retrievalPriority: 10,
    collectionKey: "inbox:notes",
    capturedAt: "2026-03-24T00:00:00.000Z",
    descriptorJson: null,
    createdAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z",
  };

  return {
    id: "chunk:chunk-1",
    layer: "chunk",
    score: 0.95,
    asset,
    source: {
      sourceUrl: null,
      sourceKind: "manual",
      sourceHost: null,
      capturedAt: "2026-03-24T00:00:00.000Z",
    },
    indexing: {
      matchedLayer: "chunk",
      domain: "engineering",
      documentClass: null,
      sourceHost: null,
      collectionKey: "inbox:notes",
      aiVisibility: "allow",
      sourceKind: "manual",
      topics: ["cloudmind"],
      assertionKind: null,
    },
    visibility: {
      aiVisibility: "allow",
      sensitivity: "internal",
    },
    text: "Vectorize stores semantic chunks",
    snippet: "Vectorize stores semantic chunks",
    chunkId: "chunk-1",
    chunkIndex: 0,
    vectorId: "vector-1",
    ...overrides,
  };
};

describe("buildGroupedEvidence", () => {
  it("groups evidence by asset and dedupes same-layer repeated text", () => {
    const groupedEvidence = buildGroupedEvidence([
      createEvidenceItem(),
      createEvidenceItem({
        id: "chunk:chunk-2",
        chunkId: "chunk-2",
        chunkIndex: 1,
        text: "Vectorize   stores semantic chunks",
        snippet: "Vectorize stores semantic chunks",
        score: 0.91,
      }),
      createEvidenceItem({
        id: "summary:asset-1",
        layer: "summary",
        score: 0.72,
        text: "This note explains semantic retrieval choices.",
        snippet: "This note explains semantic retrieval choices.",
      }),
      createEvidenceItem({
        id: "chunk:chunk-3",
        chunkId: "chunk-3",
        chunkIndex: 0,
        vectorId: "vector-3",
        score: 0.82,
        asset: {
          ...createEvidenceItem().asset,
          id: "asset-2",
          title: "CloudMind Design",
        },
        text: "D1 stores metadata and filters.",
        snippet: "D1 stores metadata and filters.",
      }),
    ]);

    expect(groupedEvidence).toHaveLength(2);
    expect(groupedEvidence[0]).toEqual({
      asset: expect.objectContaining({
        id: "asset-1",
      }),
      topScore: 0.95,
      matchedLayers: ["chunk", "summary"],
      items: [
        expect.objectContaining({
          id: "chunk:chunk-1",
          layer: "chunk",
        }),
        expect.objectContaining({
          id: "summary:asset-1",
          layer: "summary",
        }),
      ],
    });
    expect(groupedEvidence[0]?.items).toHaveLength(2);
    expect(groupedEvidence[1]).toEqual({
      asset: expect.objectContaining({
        id: "asset-2",
      }),
      topScore: 0.82,
      matchedLayers: ["chunk"],
      items: [
        expect.objectContaining({
          id: "chunk:chunk-3",
          layer: "chunk",
        }),
      ],
    });
  });
});
