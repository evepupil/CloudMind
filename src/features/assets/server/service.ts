import type {
  AssetRepository,
  UpdateAssetMetadataInput,
} from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
import type { AppBindings } from "@/env";
import type {
  AssetDetail,
  AssetListQuery,
  AssetListResult,
} from "@/features/assets/model/types";
import { getBlobStoreFromBindings } from "@/platform/blob/r2/get-blob-store";
import { getAssetRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";

const hydrateAssetContent = async (
  blobStore: BlobStore,
  item: AssetDetail
): Promise<AssetDetail> => {
  if (!item.contentR2Key) {
    return item;
  }

  const object = await blobStore.get(item.contentR2Key);

  if (!object) {
    return item;
  }

  return {
    ...item,
    contentText: new TextDecoder().decode(object.body),
  };
};

interface AssetServiceDependencies {
  getAssetRepository: (
    bindings: AppBindings | undefined
  ) => AssetRepository | Promise<AssetRepository>;
  getBlobStore: (
    bindings: AppBindings | undefined
  ) => BlobStore | Promise<BlobStore>;
}

const defaultDependencies: AssetServiceDependencies = {
  getAssetRepository: getAssetRepositoryFromBindings,
  getBlobStore: getBlobStoreFromBindings,
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
      const blobStore = await dependencies.getBlobStore(bindings);
      const item = await repository.getAssetById(id);

      return hydrateAssetContent(blobStore, item);
    },

    async updateAsset(
      bindings: AppBindings | undefined,
      id: string,
      input: UpdateAssetMetadataInput
    ): Promise<AssetDetail> {
      const repository = await dependencies.getAssetRepository(bindings);
      const blobStore = await dependencies.getBlobStore(bindings);
      const item = await repository.updateAssetMetadata(id, input);

      return hydrateAssetContent(blobStore, item);
    },

    async deleteAsset(
      bindings: AppBindings | undefined,
      id: string
    ): Promise<void> {
      const repository = await dependencies.getAssetRepository(bindings);

      await repository.softDeleteAsset(id);
    },

    async restoreAsset(
      bindings: AppBindings | undefined,
      id: string
    ): Promise<AssetDetail> {
      const repository = await dependencies.getAssetRepository(bindings);
      const blobStore = await dependencies.getBlobStore(bindings);
      const item = await repository.restoreAsset(id);

      return hydrateAssetContent(blobStore, item);
    },
  };
};

const assetService = createAssetService();

export const { listAssets, getAssetById, updateAsset, deleteAsset, restoreAsset } =
  assetService;
