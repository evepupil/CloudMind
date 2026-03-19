import type {
  AssetSearchInput,
  AssetSearchRepository,
} from "@/core/assets/ports";
import type { AppBindings } from "@/env";
import type { AssetListResult } from "@/features/assets/model/types";
import { getAssetSearchRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";

interface SearchServiceDependencies {
  getAssetRepository: (
    bindings: AppBindings | undefined
  ) => AssetSearchRepository | Promise<AssetSearchRepository>;
}

const defaultDependencies: SearchServiceDependencies = {
  getAssetRepository: getAssetSearchRepositoryFromBindings,
};

// 这里收敛资产搜索用例，后续可把关键词搜索替换为混合检索而不影响调用方。
export const createSearchService = (
  dependencies: SearchServiceDependencies = defaultDependencies
) => {
  return {
    async searchAssets(
      bindings: AppBindings | undefined,
      input: AssetSearchInput
    ): Promise<AssetListResult> {
      const repository = await dependencies.getAssetRepository(bindings);

      return repository.searchAssets(input);
    },
  };
};

const searchService = createSearchService();

export const { searchAssets } = searchService;
