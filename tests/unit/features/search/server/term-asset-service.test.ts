import { describe, expect, it, vi } from "vitest";

import type { AssetSearchRepository } from "@/core/assets/ports";
import { createTermAssetService } from "@/features/search/server/term-asset-service";

vi.mock("@/features/search/server/term-service", () => {
  return {
    searchTerms: vi.fn(),
  };
});

import { searchTerms } from "@/features/search/server/term-service";

describe("term asset service", () => {
  it("forwards metadata-safe aiVisibility filters to reverse lookup", async () => {
    const repository: AssetSearchRepository = {
      searchAssets: vi.fn(),
      getChunkMatchesByVectorIds: vi.fn(),
      searchAssetSummaries: vi.fn(),
      getAssetsByFacetTerms: vi.fn().mockResolvedValue({
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 0,
        },
      }),
    };
    const service = createTermAssetService({
      getAssetRepository: vi.fn().mockResolvedValue(repository),
    });

    vi.mocked(searchTerms).mockResolvedValue({
      items: [
        {
          kind: "topic",
          term: "cloudmind",
          normalized: "cloudmind",
          score: 0.93,
        },
        {
          kind: "collection",
          term: "project/cloudmind",
          normalized: "project/cloudmind",
          score: 0.87,
        },
      ],
    });

    await service.searchAssetsByTerms(undefined, {
      query: "cloudmind project",
      page: 1,
      pageSize: 10,
    });

    expect(repository.getAssetsByFacetTerms).toHaveBeenCalledWith({
      terms: [
        {
          facetKey: "topic",
          facetValue: "cloudmind",
        },
        {
          facetKey: "collection",
          facetValue: "project/cloudmind",
        },
      ],
      aiVisibility: ["allow", "summary_only"],
      page: 1,
      pageSize: 10,
    });
  });
});
