import type {
  AssetRepository,
  RecordContextSummary,
} from "@/core/assets/ports";
import type { BlobStore } from "@/core/blob/ports";
import { MemoryLifecycleError } from "@/core/memory/errors";
import {
  AGENT_SCOPE,
  MEMORY_SCOPES,
  type MemoryScope,
} from "@/core/memory/scope";
import { MEMORY_RECORD_KIND } from "@/core/records/classification";
import type { AppBindings } from "@/env";
import type {
  AssetDetail,
  AssetListResult,
  AssetSummary,
} from "@/features/assets/model/types";
import { getBlobStoreFromBindings } from "@/platform/blob/r2/get-blob-store";
import { getAssetRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";
import type { MemoryManagementQuery } from "./management-schemas";

export interface MemoryManagementListView {
  items: AssetSummary[];
  pagination: AssetListResult["pagination"];
  contexts: RecordContextSummary[];
  filters: MemoryManagementQuery;
}

export interface ManagedMemoryDetailView {
  item: AssetDetail;
  versions: AssetSummary[];
}

interface MemoryManagementDependencies {
  getAssetRepository: (
    bindings: AppBindings | undefined
  ) => AssetRepository | Promise<AssetRepository>;
  getBlobStore: (
    bindings: AppBindings | undefined
  ) => BlobStore | Promise<BlobStore>;
}

const defaultDependencies: MemoryManagementDependencies = {
  getAssetRepository: getAssetRepositoryFromBindings,
  getBlobStore: getBlobStoreFromBindings,
};

const hydrateContent = async (
  item: AssetDetail,
  blobStore: BlobStore
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

const requireManagementQueries = (repository: AssetRepository) => {
  if (!repository.listRecordContexts || !repository.listMemoryVersions) {
    throw new Error("Memory management queries are not available.");
  }

  return {
    listRecordContexts: repository.listRecordContexts.bind(repository),
    listMemoryVersions: repository.listMemoryVersions.bind(repository),
  };
};

const parseMemoryScope = (value: string): MemoryScope => {
  if (MEMORY_SCOPES.some((scopeId) => scopeId === value)) {
    return value as MemoryScope;
  }

  throw new MemoryLifecycleError(
    "SCOPE_MISMATCH",
    `Memory scope "${value}" is not supported.`
  );
};

export const createMemoryManagementService = (
  dependencies: MemoryManagementDependencies = defaultDependencies
) => {
  return {
    async listManagedRecords(
      bindings: AppBindings | undefined,
      query: MemoryManagementQuery
    ): Promise<MemoryManagementListView> {
      const repository = await dependencies.getAssetRepository(bindings);
      const { listRecordContexts } = requireManagementQueries(repository);
      const filters: MemoryManagementQuery = {
        ...query,
        recordKinds: query.recordKinds ?? [MEMORY_RECORD_KIND],
        scopeIds: query.scopeIds ?? [AGENT_SCOPE],
        deleted: query.deleted ?? "exclude",
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
      };
      const [result, contexts] = await Promise.all([
        repository.listAssets(filters),
        listRecordContexts({
          recordKinds: filters.recordKinds,
          scopeIds: filters.scopeIds,
          deleted: filters.deleted,
        }),
      ]);

      return {
        items: result.items,
        pagination: result.pagination,
        contexts,
        filters,
      };
    },

    async getManagedMemory(
      bindings: AppBindings | undefined,
      id: string
    ): Promise<ManagedMemoryDetailView> {
      const repository = await dependencies.getAssetRepository(bindings);
      const { listMemoryVersions } = requireManagementQueries(repository);
      const item = await repository.getAssetById(id, {
        includeDeleted: true,
      });

      if (item.recordKind !== MEMORY_RECORD_KIND) {
        throw new MemoryLifecycleError(
          "NOT_MEMORY",
          `Asset "${item.id}" is not a memory record.`
        );
      }

      const [blobStore, versions] = await Promise.all([
        dependencies.getBlobStore(bindings),
        listMemoryVersions({
          memoryRootId: item.memoryRootId ?? item.id,
          scopeId: parseMemoryScope(item.scopeId),
          contextKey: item.contextKey,
        }),
      ]);

      return {
        item: await hydrateContent(item, blobStore),
        versions,
      };
    },
  };
};

const memoryManagementService = createMemoryManagementService();

export const { listManagedRecords, getManagedMemory } = memoryManagementService;
