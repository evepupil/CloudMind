import type { AssetRepository } from "@/core/assets/ports";
import type { AppBindings } from "@/env";
import type {
  AssetDetail,
  AssetListQuery,
  AssetListResult,
} from "@/features/assets/model/types";
import { getAssetRepositoryFromBindings } from "@/platform/db/d1/get-asset-repository";

interface AssetServiceDependencies {
  getAssetRepository: (
    bindings: AppBindings | undefined
  ) => AssetRepository | Promise<AssetRepository>;
}

const defaultDependencies: AssetServiceDependencies = {
  getAssetRepository: getAssetRepositoryFromBindings,
};

// 这里收敛资产读取与搜索用例，避免继续混入采集写入逻辑。
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

    async searchAssets(
      bindings: AppBindings | undefined,
      query: {
        query: string;
        page?: number | undefined;
        pageSize?: number | undefined;
      }
    ): Promise<AssetListResult> {
      const repository = await dependencies.getAssetRepository(bindings);

      return repository.listAssets({
        query: query.query,
        page: query.page,
        pageSize: query.pageSize,
      });
    },
  };
};

const assetService = createAssetService();

export const { listAssets, getAssetById, searchAssets } = assetService;
