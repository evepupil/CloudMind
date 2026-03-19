import type { AssetQueryRepository } from "@/core/assets/ports";
import type { AppBindings } from "@/env";
import type {
  AssetDetail,
  AssetListQuery,
  AssetListResult,
} from "@/features/assets/model/types";
import { getAssetQueryRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";

interface AssetServiceDependencies {
  getAssetRepository: (
    bindings: AppBindings | undefined
  ) => AssetQueryRepository | Promise<AssetQueryRepository>;
}

const defaultDependencies: AssetServiceDependencies = {
  getAssetRepository: getAssetQueryRepositoryFromBindings,
};

// 这里收敛资产读模型用例，避免继续混入搜索和采集写入逻辑。
export const createAssetService = (
  dependencies: AssetServiceDependencies = defaultDependencies
) => {
  return {
    async listAssets(
      bindings: AppBindings | undefined,
      query?: AssetListQuery
    ): Promise<AssetListResult> {
      const repository = await dependencies.getAssetRepository(bindings);

      return repository.listAssets(query);
    },

    async getAssetById(
      bindings: AppBindings | undefined,
      id: string
    ): Promise<AssetDetail> {
      const repository = await dependencies.getAssetRepository(bindings);

      return repository.getAssetById(id);
    },
  };
};

const assetService = createAssetService();

export const { listAssets, getAssetById } = assetService;
