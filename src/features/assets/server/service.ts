import { D1AssetRepository } from "@/db/repositories/d1-asset-repository";
import type { AppBindings } from "@/env";
import type {
  AssetDetail,
  AssetListQuery,
  AssetListResult,
} from "@/features/assets/model/types";

import {
  type BlobStore,
  BlobStoreConfigError,
  createRawAssetBlobKey,
  R2BlobStore,
} from "./blob-store";
import { processTextAsset, processUrlAsset } from "./processor";
import type {
  AssetRepository,
  CreateFileAssetInput,
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

const getBlobStore = (bindings: AppBindings | undefined): BlobStore => {
  if (!bindings?.ASSET_FILES) {
    throw new BlobStoreConfigError(
      'Cloudflare R2 binding "ASSET_FILES" is not configured. ' +
        "Create the bucket and bind it in wrangler.jsonc before using file ingest."
    );
  }

  return new R2BlobStore(bindings.ASSET_FILES);
};

interface AssetServiceDependencies {
  getAssetRepository: (
    bindings: AppBindings | undefined
  ) => AssetRepository | Promise<AssetRepository>;
  getBlobStore: (
    bindings: AppBindings | undefined
  ) => BlobStore | Promise<BlobStore>;
  processTextAsset: (
    repository: AssetRepository,
    assetId: string
  ) => Promise<AssetDetail>;
  processUrlAsset: (
    repository: AssetRepository,
    assetId: string
  ) => Promise<AssetDetail>;
  getProcessTextAssetForced: (
    repository: AssetRepository,
    assetId: string
  ) => Promise<AssetDetail>;
  getProcessUrlAssetForced: (
    repository: AssetRepository,
    assetId: string
  ) => Promise<AssetDetail>;
}

const defaultDependencies: AssetServiceDependencies = {
  getAssetRepository,
  getBlobStore,
  processTextAsset,
  processUrlAsset,
  getProcessTextAssetForced: (repository, assetId) =>
    processTextAsset(repository, assetId, { force: true }),
  getProcessUrlAssetForced: (repository, assetId) =>
    processUrlAsset(repository, assetId, { force: true }),
};

// 这里通过 service 层收敛仓储和处理器入口，便于路由复用，也便于测试替换依赖。
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

    async createFileAsset(
      bindings: AppBindings | undefined,
      input: CreateFileAssetInput
    ): Promise<AssetDetail> {
      const repository = await dependencies.getAssetRepository(bindings);

      return repository.createFileAsset(input);
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

    async ingestFileAsset(
      bindings: AppBindings | undefined,
      input: {
        title?: string | undefined;
        file: File;
      }
    ): Promise<AssetDetail> {
      const repository = await dependencies.getAssetRepository(bindings);
      const blobStore = await dependencies.getBlobStore(bindings);
      const assetId = crypto.randomUUID();
      const rawR2Key = createRawAssetBlobKey(assetId, input.file.name);
      const contentDisposition = `inline; filename="${input.file.name.replace(
        /"/g,
        '\\"'
      )}"`;

      await blobStore.put({
        key: rawR2Key,
        body: await input.file.arrayBuffer(),
        contentType: input.file.type || "application/pdf",
        contentDisposition,
      });

      return repository.createFileAsset({
        id: assetId,
        title: input.title,
        fileName: input.file.name,
        fileSize: input.file.size,
        mimeType: input.file.type || "application/pdf",
        rawR2Key,
      });
    },

    async reprocessAsset(
      bindings: AppBindings | undefined,
      id: string
    ): Promise<AssetDetail> {
      const repository = await dependencies.getAssetRepository(bindings);
      const asset = await repository.getAssetById(id);

      switch (asset.type) {
        case "note":
        case "chat":
          return dependencies.getProcessTextAssetForced(repository, asset.id);
        case "url":
          return dependencies.getProcessUrlAssetForced(repository, asset.id);
        default:
          throw new Error(
            `Asset type "${asset.type}" is not supported for reprocess.`
          );
      }
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

export const {
  listAssets,
  getAssetById,
  createTextAsset,
  createUrlAsset,
  createFileAsset,
  ingestTextAsset,
  ingestUrlAsset,
  ingestFileAsset,
  reprocessAsset,
  searchAssets,
} = assetService;
