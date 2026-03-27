import { describe, expect, it } from "vitest";

import { sortFacetMatchedAssets } from "@/platform/db/d1/repositories/d1-asset-repository";

describe("d1 asset repository facet term ranking", () => {
  it("orders matches by term rank, term coverage, then recency", () => {
    const result = sortFacetMatchedAssets(
      [
        {
          assetId: "asset-c",
          createdAt: "2026-03-20T00:00:00.000Z",
          matchedTerms: [
            {
              facetKey: "tag",
              facetValue: "mvp",
            },
          ],
        },
        {
          assetId: "asset-a",
          createdAt: "2026-03-21T00:00:00.000Z",
          matchedTerms: [
            {
              facetKey: "topic",
              facetValue: "cloudmind",
            },
          ],
        },
        {
          assetId: "asset-b",
          createdAt: "2026-03-19T00:00:00.000Z",
          matchedTerms: [
            {
              facetKey: "topic",
              facetValue: "cloudmind",
            },
            {
              facetKey: "collection",
              facetValue: "project/cloudmind",
            },
          ],
        },
      ],
      [
        {
          facetKey: "topic",
          facetValue: "cloudmind",
        },
        {
          facetKey: "collection",
          facetValue: "project/cloudmind",
        },
        {
          facetKey: "tag",
          facetValue: "mvp",
        },
      ]
    );

    expect(result.map((item) => item.assetId)).toEqual([
      "asset-b",
      "asset-a",
      "asset-c",
    ]);
  });
});
