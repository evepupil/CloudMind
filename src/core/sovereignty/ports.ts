import type { MemoryScope } from "@/core/memory/scope";
import type { ContextKey } from "@/core/records/classification";

export interface MemoryPurgeTarget {
  id: string;
  scopeId: MemoryScope;
  contextKey: ContextKey;
  createdAfter?: string | undefined;
}

export interface MemoryPurgePlan {
  auditId: string;
  assetIds: string[];
  blobKeys: string[];
  assetVectorIds: string[];
  graphVectorIds: string[];
  statementIds: string[];
  edgeIds: string[];
  entityIds: string[];
}

export interface MemoryGraphRollbackPlan {
  assetId: string;
  createdAfter: string;
  graphVectorIds: string[];
  statementIds: string[];
  edgeIds: string[];
  entityIds: string[];
}

export type MemoryPurgeFailureCode =
  | "BLOB_DELETE_FAILED"
  | "ASSET_VECTOR_DELETE_FAILED"
  | "GRAPH_VECTOR_DELETE_FAILED"
  | "DATABASE_DELETE_FAILED";

export interface MemoryPurgeRepository {
  prepareMemoryRestoreRollback(
    target: MemoryPurgeTarget
  ): Promise<MemoryGraphRollbackPlan>;
  completeMemoryRestoreRollback(plan: MemoryGraphRollbackPlan): Promise<void>;
  prepareMemoryPurge(target: MemoryPurgeTarget): Promise<MemoryPurgePlan>;
  completeMemoryPurge(plan: MemoryPurgePlan): Promise<void>;
  failMemoryPurge(
    auditId: string,
    errorCode: MemoryPurgeFailureCode
  ): Promise<void>;
}
