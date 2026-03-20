import type { AIProvider } from "@/core/ai/ports";
import type {
  AssetIngestRepository,
  CreateTextAssetInput,
  CreateUrlAssetInput,
} from "@/core/assets/ports";
import { createRawAssetBlobKey } from "@/core/blob/keys";
import type { BlobStore } from "@/core/blob/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { WorkflowRepository } from "@/core/workflows/ports";
import type { AppBindings } from "@/env";
import type { AssetDetail } from "@/features/assets/model/types";
import { getAIProviderFromBindings } from "@/platform/ai/workers-ai/get-ai-provider";
import { getBlobStoreFromBindings } from "@/platform/blob/r2/get-blob-store";
import { getAssetIngestRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";
import { getWorkflowRepositoryFromBindings } from "@/platform/db/d1/repositories/get-workflow-repository";
import { getVectorStoreFromBindings } from "@/platform/vector/vectorize/get-vector-store";

import {
  processPdfAsset,
  processTextAsset,
  processUrlAsset,
} from "./processor";

interface BackfillChunkContentInput {
  dryRun?: boolean | undefined;
  limit?: number | undefined;
}

interface BackfillChunkContentResult {
  dryRun: boolean;
  candidateAssetIds: string[];
  processedAssetIds: string[];
  failedItems: Array<{
    assetId: string;
    errorMessage: string;
  }>;
}

interface IngestServiceDependencies {
  getAssetRepository: (
    bindings: AppBindings | undefined
  ) => AssetIngestRepository | Promise<AssetIngestRepository>;
  getBlobStore: (
    bindings: AppBindings | undefined
  ) => BlobStore | Promise<BlobStore>;
  getVectorStore: (
    bindings: AppBindings | undefined
  ) => VectorStore | Promise<VectorStore>;
  getWorkflowRepository: (
    bindings: AppBindings | undefined
  ) => WorkflowRepository | Promise<WorkflowRepository>;
  getAIProvider: (
    bindings: AppBindings | undefined
  ) => AIProvider | Promise<AIProvider>;
  processTextAsset: (
    repository: AssetIngestRepository,
    workflowRepository: WorkflowRepository,
    blobStore: BlobStore,
    vectorStore: VectorStore,
    aiProvider: AIProvider,
    assetId: string,
    options?: {
      force?: boolean;
    }
  ) => Promise<AssetDetail>;
  processUrlAsset: (
    repository: AssetIngestRepository,
    assetId: string
  ) => Promise<AssetDetail>;
  processPdfAsset: (
    repository: AssetIngestRepository,
    blobStore: BlobStore,
    vectorStore: VectorStore,
    aiProvider: AIProvider,
    assetId: string
  ) => Promise<AssetDetail>;
  getProcessTextAssetForced: (
    repository: AssetIngestRepository,
    workflowRepository: WorkflowRepository,
    blobStore: BlobStore,
    vectorStore: VectorStore,
    aiProvider: AIProvider,
    assetId: string,
    options?: {
      force?: boolean;
    }
  ) => Promise<AssetDetail>;
  getProcessUrlAssetForced: (
    repository: AssetIngestRepository,
    assetId: string
  ) => Promise<AssetDetail>;
  getProcessPdfAssetForced: (
    repository: AssetIngestRepository,
    blobStore: BlobStore,
    vectorStore: VectorStore,
    aiProvider: AIProvider,
    assetId: string
  ) => Promise<AssetDetail>;
}

const defaultDependencies: IngestServiceDependencies = {
  getAssetRepository: getAssetIngestRepositoryFromBindings,
  getBlobStore: getBlobStoreFromBindings,
  getVectorStore: getVectorStoreFromBindings,
  getWorkflowRepository: getWorkflowRepositoryFromBindings,
  getAIProvider: getAIProviderFromBindings,
  processTextAsset,
  processUrlAsset,
  processPdfAsset,
  getProcessTextAssetForced: (
    repository,
    workflowRepository,
    blobStore,
    vectorStore,
    aiProvider,
    assetId
  ) =>
    processTextAsset(
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      assetId,
      {
        force: true,
      }
    ),
  getProcessUrlAssetForced: (repository, assetId) =>
    processUrlAsset(repository, assetId, { force: true }),
  getProcessPdfAssetForced: (
    repository,
    blobStore,
    vectorStore,
    aiProvider,
    assetId
  ) =>
    processPdfAsset(repository, blobStore, vectorStore, aiProvider, assetId, {
      force: true,
    }),
};

const reprocessExistingAsset = async (
  dependencies: IngestServiceDependencies,
  bindings: AppBindings | undefined,
  repository: AssetIngestRepository,
  asset: AssetDetail
): Promise<AssetDetail> => {
  switch (asset.type) {
    case "note":
    case "chat": {
      const [blobStore, vectorStore, workflowRepository, aiProvider] =
        await Promise.all([
          dependencies.getBlobStore(bindings),
          dependencies.getVectorStore(bindings),
          dependencies.getWorkflowRepository(bindings),
          dependencies.getAIProvider(bindings),
        ]);

      return dependencies.getProcessTextAssetForced(
        repository,
        workflowRepository,
        blobStore,
        vectorStore,
        aiProvider,
        asset.id
      );
    }
    case "url":
      return dependencies.getProcessUrlAssetForced(repository, asset.id);
    case "pdf": {
      const [blobStore, vectorStore, aiProvider] = await Promise.all([
        dependencies.getBlobStore(bindings),
        dependencies.getVectorStore(bindings),
        dependencies.getAIProvider(bindings),
      ]);

      return dependencies.getProcessPdfAssetForced(
        repository,
        blobStore,
        vectorStore,
        aiProvider,
        asset.id
      );
    }
    default:
      throw new Error(
        `Asset type "${asset.type}" is not supported for reprocess.`
      );
  }
};

// 这里集中采集与重处理用例，避免继续和资产读模型耦合。
export const createIngestService = (
  dependencies: IngestServiceDependencies = defaultDependencies
) => {
  return {
    async ingestTextAsset(
      bindings: AppBindings | undefined,
      input: CreateTextAssetInput
    ): Promise<AssetDetail> {
      const repository = await dependencies.getAssetRepository(bindings);
      const blobStore = await dependencies.getBlobStore(bindings);
      const vectorStore = await dependencies.getVectorStore(bindings);
      const workflowRepository =
        await dependencies.getWorkflowRepository(bindings);
      const aiProvider = await dependencies.getAIProvider(bindings);
      const createdAsset = await repository.createTextAsset(input);

      return dependencies.processTextAsset(
        repository,
        workflowRepository,
        blobStore,
        vectorStore,
        aiProvider,
        createdAsset.id
      );
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
      const vectorStore = await dependencies.getVectorStore(bindings);
      const aiProvider = await dependencies.getAIProvider(bindings);
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

      const createdAsset = await repository.createFileAsset({
        id: assetId,
        title: input.title,
        fileName: input.file.name,
        fileSize: input.file.size,
        mimeType: input.file.type || "application/pdf",
        rawR2Key,
      });

      return dependencies.processPdfAsset(
        repository,
        blobStore,
        vectorStore,
        aiProvider,
        createdAsset.id
      );
    },

    async reprocessAsset(
      bindings: AppBindings | undefined,
      id: string
    ): Promise<AssetDetail> {
      const repository = await dependencies.getAssetRepository(bindings);
      const asset = await repository.getAssetById(id);

      return reprocessExistingAsset(dependencies, bindings, repository, asset);
    },

    async backfillChunkContent(
      bindings: AppBindings | undefined,
      input?: BackfillChunkContentInput
    ): Promise<BackfillChunkContentResult> {
      const repository = await dependencies.getAssetRepository(bindings);
      const candidateAssetIds =
        await repository.listAssetIdsMissingChunkContent(input?.limit ?? 50);

      if (input?.dryRun ?? false) {
        return {
          dryRun: true,
          candidateAssetIds,
          processedAssetIds: [],
          failedItems: [],
        };
      }

      const processedAssetIds: string[] = [];
      const failedItems: BackfillChunkContentResult["failedItems"] = [];

      for (const assetId of candidateAssetIds) {
        try {
          const asset = await repository.getAssetById(assetId);

          await reprocessExistingAsset(
            dependencies,
            bindings,
            repository,
            asset
          );
          processedAssetIds.push(assetId);
        } catch (error) {
          failedItems.push({
            assetId,
            errorMessage:
              error instanceof Error
                ? error.message
                : "Unknown backfill error.",
          });
        }
      }

      return {
        dryRun: false,
        candidateAssetIds,
        processedAssetIds,
        failedItems,
      };
    },
  };
};

const ingestService = createIngestService();

export const {
  ingestTextAsset,
  ingestUrlAsset,
  ingestFileAsset,
  reprocessAsset,
  backfillChunkContent,
} = ingestService;
