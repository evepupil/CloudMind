import type {
  MemoryGraphCounts,
  MemoryGraphEdge,
  MemoryGraphEntity,
  MemoryStatement,
} from "@/core/memory/ports";
import { PERSONAL_SCOPE } from "@/core/memory/scope";
import type { AppBindings } from "@/env";
import { getMemoryRepositoryFromBindings } from "@/platform/db/d1/repositories/get-memory-repository";

// 记忆图谱视图数据：节点 + 边 + 计数（默认 personal scope）。
export interface GraphView {
  entities: MemoryGraphEntity[];
  edges: MemoryGraphEdge[];
  counts: MemoryGraphCounts;
}

// 取记忆图谱视图（实体 + 活跃边 + 计数）。
export const getGraphView = async (
  bindings: AppBindings | undefined,
  limit = 80
): Promise<GraphView> => {
  const repository = getMemoryRepositoryFromBindings(bindings);
  const [entities, edges, counts] = await Promise.all([
    repository.listEntities({ scopeId: PERSONAL_SCOPE, limit }),
    repository.listActiveEdges(PERSONAL_SCOPE),
    repository.countGraph(PERSONAL_SCOPE),
  ]);

  return { entities, edges, counts };
};

// 时间线视图：陈述（含失效，按创建时间降序）+ 实体名映射（把 entityId 渲染成名字）。
export interface TimelineView {
  statements: MemoryStatement[];
  entityNames: Record<string, string>;
  counts: MemoryGraphCounts;
}

export const getTimelineView = async (
  bindings: AppBindings | undefined,
  limit = 100
): Promise<TimelineView> => {
  const repository = getMemoryRepositoryFromBindings(bindings);
  const [statements, entities, counts] = await Promise.all([
    repository.listStatements({
      scopeId: PERSONAL_SCOPE,
      includeExpired: true,
      limit,
    }),
    repository.listEntities({ scopeId: PERSONAL_SCOPE, limit: 500 }),
    repository.countGraph(PERSONAL_SCOPE),
  ]);

  const entityNames: Record<string, string> = {};
  for (const entity of entities) {
    entityNames[entity.id] = entity.canonicalName;
  }

  return { statements, entityNames, counts };
};

// 整合视图：当前待办问题（漂移边 + 重复陈述）实时快照。
export interface ConsolidationView {
  driftedEdges: MemoryGraphEdge[];
  duplicateCount: number;
  counts: MemoryGraphCounts;
  entityNames: Record<string, string>;
}

export const getConsolidationView = async (
  bindings: AppBindings | undefined
): Promise<ConsolidationView> => {
  const repository = getMemoryRepositoryFromBindings(bindings);
  const [drifted, duplicates, counts, entities] = await Promise.all([
    repository.findDriftedEdges(PERSONAL_SCOPE),
    repository.findDuplicateActiveStatements(PERSONAL_SCOPE),
    repository.countGraph(PERSONAL_SCOPE),
    repository.listEntities({ scopeId: PERSONAL_SCOPE, limit: 500 }),
  ]);

  const entityNames: Record<string, string> = {};
  for (const entity of entities) {
    entityNames[entity.id] = entity.canonicalName;
  }

  return {
    driftedEdges: drifted.map((edge) => ({
      id: edge.id,
      scopeId: edge.scopeId,
      srcEntityId: edge.srcEntityId,
      dstEntityId: edge.dstEntityId,
      relation: edge.relation,
    })),
    duplicateCount: duplicates.length,
    counts,
    entityNames,
  };
};

// 仅取计数（供 Overview 计量条）。
export const getMemoryCounts = async (
  bindings: AppBindings | undefined
): Promise<MemoryGraphCounts> => {
  const repository = getMemoryRepositoryFromBindings(bindings);
  return repository.countGraph(PERSONAL_SCOPE);
};
