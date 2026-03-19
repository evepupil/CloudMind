import { D1AssetRepository } from "@/db/repositories/d1-asset-repository";
import type { AppBindings } from "@/env";
import type { AssetDetail, AssetSummary } from "@/features/assets/model/types";

import { processTextAsset } from "./processor";
import type { CreateTextAssetInput } from "./repository";

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

// 这里通过 service 层收敛仓储入口，避免页面和路由直接 new 基础设施实现。
export const listAssets = async (
  bindings: AppBindings | undefined
): Promise<AssetSummary[]> => {
  return getAssetRepository(bindings).listAssets();
};

export const getAssetById = async (
  bindings: AppBindings | undefined,
  id: string
): Promise<AssetDetail> => {
  return getAssetRepository(bindings).getAssetById(id);
};

export const createTextAsset = async (
  bindings: AppBindings | undefined,
  input: CreateTextAssetInput
): Promise<AssetDetail> => {
  return getAssetRepository(bindings).createTextAsset(input);
};

export const ingestTextAsset = async (
  bindings: AppBindings | undefined,
  input: CreateTextAssetInput
): Promise<AssetDetail> => {
  const repository = getAssetRepository(bindings);
  const createdAsset = await repository.createTextAsset(input);

  return processTextAsset(repository, createdAsset.id);
};
