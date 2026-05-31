import { describe, expect, it } from "vitest";

import type { CreateAssetFacetInput } from "@/core/assets/ports";
import type { AssetDetail } from "@/features/assets/model/types";
import type {
  AssetAccessPolicy,
  AssetDescriptor,
  DeriveIndexingContext,
} from "@/features/workflows/server/indexing-policy";
import {
  deriveAccessPolicy,
  deriveAssertions,
  deriveDescriptor,
  deriveFacets,
} from "@/features/workflows/server/indexing-policy";

const createAsset = (overrides: Partial<AssetDetail> = {}): AssetDetail => {
  return {
    id: "asset-1",
    type: "url",
    title: "Cloudflare Workers queue quickstart",
    summary: null,
    sourceUrl: "https://developers.cloudflare.com/queues/get-started/",
    sourceKind: "manual",
    status: "ready",
    domain: "general",
    sensitivity: "internal",
    aiVisibility: "allow",
    retrievalPriority: 0,
    documentClass: "reference_doc",
    sourceHost: null,
    collectionKey: null,
    capturedAt: "2026-05-01T10:00:00.000Z",
    descriptorJson: null,
    createdAt: "2026-05-01T09:00:00.000Z",
    updatedAt: "2026-05-01T10:30:00.000Z",
    contentText: null,
    rawR2Key: null,
    contentR2Key: null,
    mimeType: "text/markdown",
    language: " EN ",
    errorMessage: null,
    processedAt: null,
    failedAt: null,
    source: null,
    jobs: [],
    chunks: [],
    ...overrides,
  };
};

const createContext = (
  overrides: Partial<DeriveIndexingContext> = {}
): DeriveIndexingContext => {
  return {
    asset: createAsset(),
    normalizedContent:
      "This TypeScript quickstart explains Worker queues, semantic search, D1, R2, and Vectorize.",
    summary: "Guide for Cloudflare queue ingestion.",
    ...overrides,
  };
};

describe("indexing policy", () => {
  it("derives engineering descriptor metadata from documentation signals", () => {
    const result = deriveDescriptor(createContext());

    expect(result.descriptor).toEqual(
      expect.objectContaining({
        version: 2,
        strategy: "heuristic_v2",
        assetType: "url",
        sourceKind: "manual",
        domain: "engineering",
        documentClass: "howto",
        topics: ["typescript", "retrieval", "workflow"],
        tags: ["typescript", "retrieval", "workflow"],
        collectionKey: "site:developers.cloudflare.com",
        capturedAt: "2026-05-01T10:00:00.000Z",
        sourceHost: "developers.cloudflare.com",
        language: "en",
        mimeType: "text/markdown",
        signals: ["engineering_keyword"],
      })
    );
    expect(result.indexing).toEqual(
      expect.objectContaining({
        sourceKind: "manual",
        domain: "engineering",
        documentClass: "howto",
        sourceHost: "developers.cloudflare.com",
        collectionKey: "site:developers.cloudflare.com",
        capturedAt: "2026-05-01T10:00:00.000Z",
      })
    );
    expect(JSON.parse(result.indexing.descriptorJson ?? "{}")).toEqual(
      result.descriptor
    );
  });

  it("falls back to nested source metadata when asset fields are empty", () => {
    const asset = createAsset({
      sourceUrl: null,
      sourceKind: null,
      title: "Personal memory",
      source: {
        kind: "mcp",
        sourceUrl: "https://example.com/private-note",
        metadataJson: null,
        createdAt: "2026-05-01T09:00:00.000Z",
      },
      type: "note",
      capturedAt: null,
    });

    const result = deriveDescriptor(
      createContext({
        asset,
        normalizedContent: "A personal memory about family travel.",
        summary: null,
      })
    );

    expect(result.descriptor).toEqual(
      expect.objectContaining({
        sourceKind: "mcp",
        domain: "personal",
        documentClass: "journal_entry",
        collectionKey: "site:example.com",
        capturedAt: "2026-05-01T09:00:00.000Z",
        sourceHost: "example.com",
      })
    );
  });

  it("derives public access policy for public docs and restricted policy for secrets", () => {
    const publicDescriptor = deriveDescriptor(createContext()).descriptor;

    expect(
      deriveAccessPolicy(createContext(), publicDescriptor).policy
    ).toEqual(
      expect.objectContaining({
        sensitivity: "public",
        aiVisibility: "allow",
        retrievalPriority: 50,
        reasons: ["public_host"],
      })
    );

    const restrictedContext = createContext({
      asset: createAsset({
        type: "note",
        sourceUrl: null,
        title: "Deployment secret",
      }),
      normalizedContent: "The access token and private key must stay sealed.",
      summary: null,
    });
    const restrictedDescriptor: AssetDescriptor = {
      ...deriveDescriptor(restrictedContext).descriptor,
      domain: "engineering",
      sourceHost: null,
    };

    expect(
      deriveAccessPolicy(restrictedContext, restrictedDescriptor).policy
    ).toEqual(
      expect.objectContaining({
        sensitivity: "restricted",
        aiVisibility: "deny",
        retrievalPriority: 10,
        reasons: ["restricted_keyword"],
      })
    );
  });

  it("derives private access policy for sensitive domains", () => {
    const financeContext = createContext({
      asset: createAsset({
        sourceUrl: null,
        title: "Budget review",
      }),
      normalizedContent: "Quarterly budget and expense notes.",
      summary: null,
    });
    const descriptor = deriveDescriptor(financeContext).descriptor;

    expect(deriveAccessPolicy(financeContext, descriptor).policy).toEqual(
      expect.objectContaining({
        sensitivity: "private",
        aiVisibility: "summary_only",
        retrievalPriority: -15,
        reasons: ["domain:finance"],
      })
    );
  });

  it("merges system and semantic facets while sanitizing client facets", () => {
    const descriptor: AssetDescriptor = {
      ...deriveDescriptor(createContext()).descriptor,
      collectionKey: "site:developers.cloudflare.com",
      topics: ["typescript"],
      tags: ["workflow"],
    };
    const policy: AssetAccessPolicy = {
      version: 1,
      strategy: "heuristic_v1",
      sensitivity: "public",
      aiVisibility: "allow",
      retrievalPriority: 50,
      reasons: ["public_host"],
    };
    const clientFacets: CreateAssetFacetInput[] = [
      {
        facetKey: "topic",
        facetValue: " TypeScript ",
        facetLabel: "TypeScript duplicate",
      },
      {
        facetKey: "topic",
        facetValue: " document ",
        facetLabel: "Generic term",
      },
      {
        facetKey: "tag",
        facetValue: " RAG ",
        facetLabel: " Retrieval ",
      },
      {
        facetKey: "collection",
        facetValue: "site:ignored.example",
        facetLabel: "Ignored collection",
      },
      {
        facetKey: "domain",
        facetValue: "product",
        facetLabel: "Not semantic",
      },
    ];

    const facets = deriveFacets(descriptor, policy, clientFacets);

    expect(facets).toEqual([
      expect.objectContaining({
        facetKey: "domain",
        facetValue: "engineering",
      }),
      expect.objectContaining({
        facetKey: "document_class",
        facetValue: "howto",
      }),
      expect.objectContaining({ facetKey: "asset_type", facetValue: "url" }),
      expect.objectContaining({
        facetKey: "source_kind",
        facetValue: "manual",
      }),
      expect.objectContaining({
        facetKey: "source_host",
        facetValue: "developers.cloudflare.com",
      }),
      expect.objectContaining({ facetKey: "year", facetValue: "2026" }),
      expect.objectContaining({
        facetKey: "ai_visibility",
        facetValue: "allow",
      }),
      expect.objectContaining({
        facetKey: "sensitivity",
        facetValue: "public",
      }),
      expect.objectContaining({
        facetKey: "collection",
        facetValue: "site:developers.cloudflare.com",
      }),
      expect.objectContaining({ facetKey: "topic", facetValue: "typescript" }),
      expect.objectContaining({ facetKey: "tag", facetValue: "workflow" }),
      expect.objectContaining({ facetKey: "tag", facetValue: "RAG" }),
    ]);
    expect(facets.map((facet) => facet.sortOrder)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
  });

  it("derives ordered assertions from summary and deduped statements", () => {
    const assertions = deriveAssertions(
      createContext({
        summary: "CloudMind stores original assets before derived summaries.",
        normalizedContent:
          "We decided to adopt D1 for metadata storage. " +
          "The system must preserve raw content for rebuilds. " +
          "We decided to adopt D1 for metadata storage. " +
          "Tiny note.",
      })
    );

    expect(assertions).toEqual([
      expect.objectContaining({
        assertionIndex: 0,
        kind: "summary_point",
        text: "CloudMind stores original assets before derived summaries.",
        confidence: 0.92,
      }),
      expect.objectContaining({
        assertionIndex: 1,
        kind: "decision",
        text: "We decided to adopt D1 for metadata storage.",
        confidence: 0.78,
      }),
      expect.objectContaining({
        assertionIndex: 2,
        kind: "constraint",
        text: "The system must preserve raw content for rebuilds.",
        confidence: 0.78,
      }),
    ]);
  });
});
