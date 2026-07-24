import type { AssetRepository } from "@/core/assets/ports";
import { createLogger } from "@/core/logging/logger";
import { MemoryLifecycleError } from "@/core/memory/errors";
import type { MemoryScope } from "@/core/memory/scope";
import {
  type ContextKey,
  MEMORY_RECORD_KIND,
} from "@/core/records/classification";
import type { VectorStore } from "@/core/vector/ports";
import type { AppBindings } from "@/env";
import type { AssetDetail } from "@/features/assets/model/types";
import {
  ingestTextAsset,
  reprocessAsset,
} from "@/features/ingest/server/service";
import { getAssetRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";
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

interface MemoryLifecycleDependencies {
  getAssetRepository: (
    bindings: AppBindings | undefined
  ) => AssetRepository | Promise<AssetRepository>;
  getVectorStore: (
    bindings: AppBindings | undefined
  ) => VectorStore | Promise<VectorStore>;
  ingestTextAsset: typeof ingestTextAsset;
  reprocessAsset: typeof reprocessAsset;
}

const defaultDependencies: MemoryLifecycleDependencies = {
  getAssetRepository: getAssetRepositoryFromBindings,
  getVectorStore: getVectorStoreFromBindings,
  ingestTextAsset,
  reprocessAsset,
};

const logger = createLogger("memory_lifecycle");

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

      if (previous.supersededAt) {
        throw new MemoryLifecycleError(
          "NOT_CURRENT",
          `Memory "${previous.id}" has already been superseded.`
        );
      }

      if (previous.status !== "ready") {
        throw new MemoryLifecycleError(
          "NOT_READY",
          `Memory "${previous.id}" must be ready before it can be updated.`
        );
      }

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
  };
};

const memoryLifecycleService = createMemoryLifecycleService();

export const { updateMemory, forgetMemory, restoreMemory } =
  memoryLifecycleService;
