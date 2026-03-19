import { D1AssetRepository } from "@/db/repositories/d1-asset-repository";
import type { AppBindings } from "@/env";
import type {
  AssetDetail,
  AssetListQuery,
  AssetSummary,
} from "@/features/assets/model/types";

import { processTextAsset, processUrlAsset } from "./processor";
import type {
  AssetRepository,
  CreateTextAssetInput,
  CreateUrlAssetInput,
} from "./repository";

const getDatabaseBinding = (bindings: AppBindings | undefined): D1Database => {
  if (!bindings?.DB) {
    throw new Error(
      'Cloudflare D1 binding "DB" is not configured. ' +
        "Create the database and bind it in wrangler.jsonc before using assets."
    );
  }

  return bindings.DB;
};

const getAssetRepository = (bindings: AppBindings | undefined) => {
  return new D1AssetRepository(getDatabaseBinding(bindings));
};

interface AssetServiceDependencies {
  getAssetRepository: (
    bindings: AppBindings | undefined
  ) => AssetRepository | Promise<AssetRepository>;
  processTextAsset: (
    repository: AssetRepository,
    assetId: string
  ) => Promise<AssetDetail>;
  processUrlAsset: (
    repository: AssetRepository,
    assetId: string
  ) => Promise<AssetDetail>;
}

const defaultDependencies: AssetServiceDependencies = {
  getAssetRepository,
  processTextAsset,
  processUrlAsset,
};

// 这里通过 service 层收敛仓储和处理器入口，便于路由复用，也便于测试替换依赖。
export const createAssetService = (
  dependencies: AssetServiceDependencies = defaultDependencies
) => {
  return {
    async listAssets(
      bindings: AppBindings | undefined,
      query?: AssetListQuery
    ): Promise<AssetSummary[]> {
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

    async createTextAsset(
      bindings: AppBindings | undefined,
      input: CreateTextAssetInput
    ): Promise<AssetDetail> {
      const repository = await dependencies.getAssetRepository(bindings);

      return repository.createTextAsset(input);
    },

    async createUrlAsset(
      bindings: AppBindings | undefined,
      input: CreateUrlAssetInput
    ): Promise<AssetDetail> {
      const repository = await dependencies.getAssetRepository(bindings);

      return repository.createUrlAsset(input);
    },

    async ingestTextAsset(
      bindings: AppBindings | undefined,
      input: CreateTextAssetInput
    ): Promise<AssetDetail> {
      const repository = await dependencies.getAssetRepository(bindings);
      const createdAsset = await repository.createTextAsset(input);

      return dependencies.processTextAsset(repository, createdAsset.id);
    },

    async ingestUrlAsset(
      bindings: AppBindings | undefined,
      input: CreateUrlAssetInput
    ): Promise<AssetDetail> {
      const repository = await dependencies.getAssetRepository(bindings);
      const createdAsset = await repository.createUrlAsset(input);

      return dependencies.processUrlAsset(repository, createdAsset.id);
    },
  };
};

const assetService = createAssetService();

export const {
  listAssets,
  getAssetById,
  createTextAsset,
  createUrlAsset,
  ingestTextAsset,
  ingestUrlAsset,
} = assetService;
