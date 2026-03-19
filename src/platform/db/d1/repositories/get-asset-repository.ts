import type {
  AssetIngestRepository,
  AssetQueryRepository,
  AssetRepository,
  AssetSearchRepository,
} from "@/core/assets/ports";
import type { AppBindings } from "@/env";

import { D1AssetRepository } from "./d1-asset-repository";

const getDatabaseBinding = (bindings: AppBindings | undefined): D1Database => {
  if (!bindings?.DB) {
    throw new Error(
      'Cloudflare D1 binding "DB" is not configured. ' +
        "Create the database and bind it in wrangler.jsonc before using assets."
    );
  }

  return bindings.DB;
};

// 这里集中解析 D1 绑定，避免业务层直接 new 具体仓储实现。
export const getAssetRepositoryFromBindings = (
  bindings: AppBindings | undefined
): AssetRepository => {
  return new D1AssetRepository(getDatabaseBinding(bindings));
};

export const getAssetQueryRepositoryFromBindings = (
  bindings: AppBindings | undefined
): AssetQueryRepository => {
  return getAssetRepositoryFromBindings(bindings);
};

export const getAssetSearchRepositoryFromBindings = (
  bindings: AppBindings | undefined
): AssetSearchRepository => {
  return getAssetRepositoryFromBindings(bindings);
};

export const getAssetIngestRepositoryFromBindings = (
  bindings: AppBindings | undefined
): AssetIngestRepository => {
  return getAssetRepositoryFromBindings(bindings);
};
