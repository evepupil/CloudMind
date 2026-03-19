import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AssetSearchRepository } from "@/core/assets/ports";
import type { AssetListResult } from "@/features/assets/model/types";
import { createSearchService } from "@/features/search/server/service";

class InMemorySearchRepository implements AssetSearchRepository {
  public async searchAssets(): Promise<AssetListResult> {
    return {
      items: [
        {
          id: "asset-search-1",
          type: "note",
          title: "CloudMind Search Item",
          summary: "Search summary",
          sourceUrl: null,
          status: "ready",
          createdAt: "2026-03-19T00:00:00.000Z",
          updatedAt: "2026-03-19T00:00:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    };
  }
}

describe("search service", () => {
  const getAssetRepositoryMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searchAssets delegates to the repository returned for the current bindings", async () => {
    const repository = new InMemorySearchRepository();
    const searchAssetsSpy = vi.spyOn(repository, "searchAssets");
    const service = createSearchService({
      getAssetRepository: getAssetRepositoryMock.mockResolvedValue(repository),
    });

    const result = await service.searchAssets(
      { APP_NAME: "cloudmind-test" },
      {
        query: "cloudmind",
        page: 2,
        pageSize: 10,
      }
    );

    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    expect(searchAssetsSpy).toHaveBeenCalledWith({
      query: "cloudmind",
      page: 2,
      pageSize: 10,
    });
  });
});
