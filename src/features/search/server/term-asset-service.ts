import type { AppBindings } from "@/env";
import type {
  AssetAiVisibility,
  AssetFacetTermQuery,
  AssetFacetTermResult,
} from "@/features/assets/model/types";
import type { SearchTermsInput, SearchTermItem } from "./term-service";
import { getAssetSearchRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";
import { searchTerms } from "./term-service";

export interface SearchAssetsByTermsInput {
  query: string;
  kinds?: SearchTermsInput["kinds"];
  topK?: number | undefined;
  filters?:
    | import("@/features/assets/model/types").AssetSearchFilters
    | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface SearchAssetsByTermsResult {
  terms: SearchTermItem[];
  items: AssetFacetTermResult["items"];
  pagination: AssetFacetTermResult["pagination"];
}

interface TermAssetServiceDependencies {
  getAssetRepository: (
    bindings: AppBindings | undefined
  ) => Promise<import("@/core/assets/ports").AssetSearchRepository>;
}

const defaultDependencies: TermAssetServiceDependencies = {
  getAssetRepository: async (bindings) =>
    getAssetSearchRepositoryFromBindings(bindings),
};

const TERM_METADATA_VISIBLE_AI_VISIBILITY: AssetAiVisibility[] = [
  "allow",
  "summary_only",
];

export const createTermAssetService = (
  dependencies: TermAssetServiceDependencies = defaultDependencies
) => {
  return {
    async searchAssetsByTerms(
      bindings: AppBindings | undefined,
      input: SearchAssetsByTermsInput
    ): Promise<SearchAssetsByTermsResult> {
      const query = input.query.trim();

      if (!query) {
        return {
          terms: [],
          items: [],
          pagination: { page: 1, pageSize: input.pageSize ?? 20, total: 0, totalPages: 0 },
        };
      }

      // Step 1: 语义搜索匹配 term
      const termsResult = await searchTerms(bindings, {
        query,
        kinds: input.kinds,
        topK: input.topK,
      });

      if (termsResult.items.length === 0) {
        return {
          terms: [],
          items: [],
          pagination: { page: 1, pageSize: input.pageSize ?? 20, total: 0, totalPages: 0 },
        };
      }

      // Step 2: term → asset 反查
      const repository = await dependencies.getAssetRepository(bindings);

      if (!repository.getAssetsByFacetTerms) {
        return {
          terms: termsResult.items,
          items: [],
          pagination: { page: 1, pageSize: input.pageSize ?? 20, total: 0, totalPages: 0 },
        };
      }

      const facetQuery: AssetFacetTermQuery = {
        terms: termsResult.items.map((item) => ({
          facetKey: item.kind,
          facetValue: item.normalized,
        })),
        aiVisibility: [...TERM_METADATA_VISIBLE_AI_VISIBILITY],
        filters: input.filters,
        page: input.page,
        pageSize: input.pageSize,
      };

      const assetResult = await repository.getAssetsByFacetTerms(facetQuery);

      return {
        terms: termsResult.items,
        items: assetResult.items,
        pagination: assetResult.pagination,
      };
    },
  };
};

const termAssetService = createTermAssetService();

export const { searchAssetsByTerms } = termAssetService;
