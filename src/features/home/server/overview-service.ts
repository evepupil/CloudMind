import type { AppBindings } from "@/env";
import type { AssetStatus, AssetSummary } from "@/features/assets/model/types";
import { listAssets } from "@/features/assets/server/service";

// Overview 页所需的真实数据快照。
// L1（资产）走 listAssets 真实取数；L2 图谱计数（entities/statements/edges）
// 留待 Phase 5 的 GET /api/memory/* 后端补齐，此处先不编造。
export interface OverviewSnapshot {
  // 资产总数（未删除）
  totalAssets: number;
  // 按状态计数
  statusCounts: Record<AssetStatus, number>;
  // 最近采集（按创建时间倒序，取前 N）
  recentAssets: AssetSummary[];
}

const STATUS_KEYS: AssetStatus[] = ["pending", "processing", "ready", "failed"];

// 取 Overview 快照。各状态计数靠按 status 过滤的 pagination.total（D1 COUNT），
// 最近列表取第一页。所有查询并行，单用户数据量小、开销可忽略。
export const getOverviewSnapshot = async (
  bindings: AppBindings | undefined,
  recentLimit = 5
): Promise<OverviewSnapshot> => {
  const [recent, ...statusResults] = await Promise.all([
    listAssets(bindings, { page: 1, pageSize: recentLimit }),
    ...STATUS_KEYS.map((status) =>
      listAssets(bindings, { status, page: 1, pageSize: 1 })
    ),
  ]);

  const statusCounts = STATUS_KEYS.reduce(
    (acc, status, index) => {
      acc[status] = statusResults[index]?.pagination.total ?? 0;
      return acc;
    },
    { pending: 0, processing: 0, ready: 0, failed: 0 } as Record<
      AssetStatus,
      number
    >
  );

  return {
    totalAssets: recent.pagination.total,
    statusCounts,
    recentAssets: recent.items,
  };
};
