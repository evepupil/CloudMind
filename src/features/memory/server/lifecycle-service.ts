import type { AssetRepository } from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
import { createLogger } from "@/core/logging/logger";
import { MemoryLifecycleError } from "@/core/memory/errors";
import type { MemoryScope } from "@/core/memory/scope";
import {
  type ContextKey,
  MEMORY_RECORD_KIND,
} from "@/core/records/classification";
import type {
  MemoryPurgeFailureCode,
  MemoryPurgeRepository,
} from "@/core/sovereignty/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { AppBindings } from "@/env";
import type { AssetDetail } from "@/features/assets/model/types";
import {
  ingestTextAsset,
  reprocessAsset,
} from "@/features/ingest/server/service";
import { getBlobStoreFromBindings } from "@/platform/blob/r2/get-blob-store";
import { getAssetRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";
import { getMemoryPurgeRepositoryFromBindings } from "@/platform/db/d1/repositories/get-memory-purge-repository";
import { getGraphVectorStoreFromBindings } from "@/platform/vector/vectorize/get-graph-vector-store";
import { getVectorStoreFromBindings } from "@/platform/vector/vectorize/get-vector-store";

export interface MemoryTarget {
  id: string;
  scopeId: MemoryScope;
  contextKey: ContextKey;
}

export interface UpdateMemoryInput extends MemoryTarget {
  content: string;
  title?: string | undefined;
}

export interface UpdateMemoryResult {
  previous: AssetDetail;
  current: AssetDetail;
}

export interface ForgetMemoryResult {
  item: AssetDetail;
  vectorCleanupPending: boolean;
}

export interface HardDeleteMemoryInput extends MemoryTarget {
  confirmId: string;
}

export interface HardDeleteMemoryResult {
  auditId: string;
  deletedAssetCount: number;
  deletedBlobCount: number;
  deletedAssetVectorCount: number;
  deletedGraphVectorCount: number;
  deletedL2RecordCount: number;
}

interface MemoryLifecycleDependencies {
  getAssetRepository: (
    bindings: AppBindings | undefined
  ) => AssetRepository | Promise<AssetRepository>;
  getVectorStore: (
    bindings: AppBindings | undefined
  ) => VectorStore | Promise<VectorStore>;
  getGraphVectorStore: (
    bindings: AppBindings | undefined
  ) => VectorStore | Promise<VectorStore>;
  getBlobStore: (
    bindings: AppBindings | undefined
  ) => BlobStore | Promise<BlobStore>;
  getMemoryPurgeRepository: (
    bindings: AppBindings | undefined
  ) => MemoryPurgeRepository | Promise<MemoryPurgeRepository>;
  ingestTextAsset: typeof ingestTextAsset;
  reprocessAsset: typeof reprocessAsset;
}

const defaultDependencies: MemoryLifecycleDependencies = {
  getAssetRepository: getAssetRepositoryFromBindings,
  getVectorStore: getVectorStoreFromBindings,
  getGraphVectorStore: getGraphVectorStoreFromBindings,
  getBlobStore: getBlobStoreFromBindings,
  getMemoryPurgeRepository: getMemoryPurgeRepositoryFromBindings,
  ingestTextAsset,
  reprocessAsset,
};

const logger = createLogger("memory_lifecycle");

const markPurgeFailed = async (
  repository: MemoryPurgeRepository,
  auditId: string,
  errorCode: MemoryPurgeFailureCode,
  error: unknown
): Promise<never> => {
  try {
    await repository.failMemoryPurge(auditId, errorCode);
  } catch (auditError) {
    logger.error(
      "hard_delete_audit_failed",
      { auditId, errorCode },
      { error: auditError }
    );
  }

  throw error;
};

const assertMemoryTarget = (item: AssetDetail, target: MemoryTarget): void => {
  if (item.recordKind !== MEMORY_RECORD_KIND) {
    throw new MemoryLifecycleError(
      "NOT_MEMORY",
      `Asset "${item.id}" is not a memory record.`
    );
  }

  if (item.scopeId !== target.scopeId) {
    throw new MemoryLifecycleError(
      "SCOPE_MISMATCH",
      `Memory "${item.id}" does not belong to scope "${target.scopeId}".`
    );
  }

  if (item.contextKey !== target.contextKey) {
    throw new MemoryLifecycleError(
      "CONTEXT_MISMATCH",
      `Memory "${item.id}" does not belong to context "${target.contextKey}".`
    );
  }
};

const getVectorIds = (item: AssetDetail): string[] => {
  return item.chunks
    .map((chunk) => chunk.vectorId)
    .filter((value): value is string => Boolean(value));
};

const assertCurrentVersion = (item: AssetDetail): void => {
  if (item.supersededAt) {
    throw new MemoryLifecycleError(
      "NOT_CURRENT",
      `Memory "${item.id}" has already been superseded.`
    );
  }
};

const assertNoPendingSuccessor = async (
  repository: AssetRepository,
  item: AssetDetail
): Promise<void> => {
  if (!repository.listMemoryVersions) {
    return;
  }

  const versions = await repository.listMemoryVersions({
    memoryRootId: item.memoryRootId ?? item.id,
    scopeId: item.scopeId === "agent" ? "agent" : "personal",
    contextKey: item.contextKey,
  });
  const pendingSuccessor = versions.some(
    (version) =>
      version.previousVersionId === item.id &&
      !version.deletedAt &&
      !version.supersededAt
  );

  if (pendingSuccessor) {
    throw new MemoryLifecycleError(
      "UPDATE_PENDING",
      `Memory "${item.id}" already has a successor being processed.`
    );
  }
};

export const createMemoryLifecycleService = (
  dependencies: MemoryLifecycleDependencies = defaultDependencies
) => {
  return {
    async updateMemory(
      bindings: AppBindings | undefined,
      input: UpdateMemoryInput
    ): Promise<UpdateMemoryResult> {
      const repository = await dependencies.getAssetRepository(bindings);
      const previous = await repository.getAssetById(input.id);
      assertMemoryTarget(previous, input);
      assertCurrentVersion(previous);

      if (previous.status !== "ready") {
        throw new MemoryLifecycleError(
          "NOT_READY",
          `Memory "${previous.id}" must be ready before it can be updated.`
        );
      }

      await assertNoPendingSuccessor(repository, previous);

      const previousVersion = previous.memoryVersion ?? 1;
      const current = await dependencies.ingestTextAsset(bindings, {
        content: input.content,
        title: input.title ?? previous.title,
        sourceKind: "mcp",
        recordKind: MEMORY_RECORD_KIND,
        scopeId: input.scopeId,
        contextKey: input.contextKey,
        aiVisibility: previous.aiVisibility,
        memoryRootId: previous.memoryRootId ?? previous.id,
        memoryVersion: previousVersion + 1,
        previousVersionId: previous.id,
      });

      return { previous, current };
    },

    async forgetMemory(
      bindings: AppBindings | undefined,
      target: MemoryTarget
    ): Promise<ForgetMemoryResult> {
      const repository = await dependencies.getAssetRepository(bindings);
      const item = await repository.getAssetById(target.id);
      assertMemoryTarget(item, target);
      assertCurrentVersion(item);
      await assertNoPendingSuccessor(repository, item);
      await repository.softDeleteAsset(item.id);

      let vectorCleanupPending = false;
      const vectorIds = getVectorIds(item);

      if (vectorIds.length > 0) {
        try {
          const vectorStore = await dependencies.getVectorStore(bindings);
          await vectorStore.deleteByIds(vectorIds);
        } catch (error) {
          vectorCleanupPending = true;
          logger.warn(
            "forget_vector_cleanup_pending",
            { assetId: item.id, vectorCount: vectorIds.length },
            { error }
          );
        }
      }

      const deleted = await repository.getAssetById(item.id, {
        includeDeleted: true,
      });

      return { item: deleted, vectorCleanupPending };
    },

    async restoreMemory(
      bindings: AppBindings | undefined,
      target: MemoryTarget
    ): Promise<AssetDetail> {
      const repository = await dependencies.getAssetRepository(bindings);
      const deleted = await repository.getAssetById(target.id, {
        includeDeleted: true,
      });
      assertMemoryTarget(deleted, target);
      assertCurrentVersion(deleted);

      if (deleted.purgePendingAt) {
        throw new MemoryLifecycleError(
          "PURGE_PENDING",
          `Memory "${deleted.id}" has a hard delete pending.`
        );
      }

      if (!deleted.deletedAt) {
        throw new MemoryLifecycleError(
          "NOT_DELETED",
          `Memory "${deleted.id}" is not deleted.`
        );
      }

      await repository.restoreAsset(deleted.id);

      try {
        const restored = await dependencies.reprocessAsset(
          bindings,
          deleted.id
        );

        if (restored.status === "failed") {
          throw new Error(`Memory "${deleted.id}" could not be reprocessed.`);
        }

        return restored;
      } catch (error) {
        const active = await repository.getAssetById(deleted.id);
        await repository.softDeleteAsset(deleted.id);
        const vectorIds = getVectorIds(active);

        if (vectorIds.length > 0) {
          try {
            const vectorStore = await dependencies.getVectorStore(bindings);
            await vectorStore.deleteByIds(vectorIds);
          } catch (cleanupError) {
            logger.warn(
              "restore_rollback_vector_cleanup_pending",
              { assetId: deleted.id, vectorCount: vectorIds.length },
              { error: cleanupError }
            );
          }
        }

        throw error;
      }
    },

    async hardDeleteMemory(
      bindings: AppBindings | undefined,
      input: HardDeleteMemoryInput
    ): Promise<HardDeleteMemoryResult> {
      if (input.confirmId !== input.id) {
        throw new MemoryLifecycleError(
          "PURGE_CONFIRMATION_MISMATCH",
          "Hard delete confirmation does not match the memory id."
        );
      }

      const assetRepository = await dependencies.getAssetRepository(bindings);
      const item = await assetRepository.getAssetById(input.id, {
        includeDeleted: true,
      });
      assertMemoryTarget(item, input);
      assertCurrentVersion(item);

      if (!item.deletedAt) {
        throw new MemoryLifecycleError(
          "NOT_DELETED",
          `Memory "${item.id}" must be forgotten before hard delete.`
        );
      }

      const purgeRepository =
        await dependencies.getMemoryPurgeRepository(bindings);
      const plan = await purgeRepository.prepareMemoryPurge(input);
      const blobStore = await dependencies.getBlobStore(bindings);

      try {
        await blobStore.delete(plan.blobKeys);
      } catch (error) {
        return markPurgeFailed(
          purgeRepository,
          plan.auditId,
          "BLOB_DELETE_FAILED",
          error
        );
      }

      try {
        const vectorStore = await dependencies.getVectorStore(bindings);
        await vectorStore.deleteByIds(plan.assetVectorIds);
      } catch (error) {
        return markPurgeFailed(
          purgeRepository,
          plan.auditId,
          "ASSET_VECTOR_DELETE_FAILED",
          error
        );
      }

      try {
        const graphVectorStore =
          await dependencies.getGraphVectorStore(bindings);
        await graphVectorStore.deleteByIds(plan.graphVectorIds);
      } catch (error) {
        return markPurgeFailed(
          purgeRepository,
          plan.auditId,
          "GRAPH_VECTOR_DELETE_FAILED",
          error
        );
      }

      try {
        await purgeRepository.completeMemoryPurge(plan);
      } catch (error) {
        return markPurgeFailed(
          purgeRepository,
          plan.auditId,
          "DATABASE_DELETE_FAILED",
          error
        );
      }

      return {
        auditId: plan.auditId,
        deletedAssetCount: plan.assetIds.length,
        deletedBlobCount: plan.blobKeys.length,
        deletedAssetVectorCount: plan.assetVectorIds.length,
        deletedGraphVectorCount: plan.graphVectorIds.length,
        deletedL2RecordCount:
          plan.statementIds.length +
          plan.edgeIds.length +
          plan.entityIds.length,
      };
    },
  };
};

const memoryLifecycleService = createMemoryLifecycleService();

export const { updateMemory, forgetMemory, restoreMemory, hardDeleteMemory } =
  memoryLifecycleService;
