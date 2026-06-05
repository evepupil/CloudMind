import type {
  AssetRepository,
  UpdateAssetMetadataInput,
} from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { AppBindings } from "@/env";
import type {
  AssetDetail,
  AssetListQuery,
  AssetListResult,
} from "@/features/assets/model/types";
import { getBlobStoreFromBindings } from "@/platform/blob/r2/get-blob-store";
import { getAssetRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";
import { getVectorStoreFromBindings } from "@/platform/vector/vectorize/get-vector-store";

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
  getVectorStore: (
    bindings: AppBindings | undefined
  ) => VectorStore | Promise<VectorStore>;
}

const defaultDependencies: AssetServiceDependencies = {
  getAssetRepository: getAssetRepositoryFromBindings,
  getBlobStore: getBlobStoreFromBindings,
  getVectorStore: getVectorStoreFromBindings,
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
      const vectorStore = await dependencies.getVectorStore(bindings);
      // 这里在软删除前取出 chunk 的向量 id，删除后清理 Vectorize，避免遗留 ghost 向量
      // 继续占用检索 topK / 存储（forget 语义也依赖此清理）。
      const item = await repository.getAssetById(id);
      const vectorIds = item.chunks
        .map((chunk) => chunk.vectorId)
        .filter((value): value is string => Boolean(value));

      await repository.softDeleteAsset(id);

      if (vectorIds.length > 0) {
        await vectorStore.deleteByIds(vectorIds);
      }
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

export const {
  listAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
  restoreAsset,
} = assetService;
