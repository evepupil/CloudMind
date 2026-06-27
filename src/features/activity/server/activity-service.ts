import type { AppBindings } from "@/env";
import type { AssetSummary } from "@/features/assets/model/types";
import { listAssets } from "@/features/assets/server/service";

// 活动页数据：聚焦「需要关注」的资产——失败的（可重试）与处理中的（等流水线）。
// 不引新后端方法，复用 listAssets 按 status 过滤；reprocess 走既有 PRG 端点。
export interface ActivitySnapshot {
  // 失败资产（最需要关注，可重试）
  failed: AssetSummary[];
  // 处理中 + 待处理资产（流水线进行中）
  inFlight: AssetSummary[];
  counts: {
    failed: number;
    processing: number;
    pending: number;
  };
}

const PAGE = { page: 1, pageSize: 50 } as const;

export const getActivitySnapshot = async (
  bindings: AppBindings | undefined
): Promise<ActivitySnapshot> => {
  const [failed, processing, pending] = await Promise.all([
    listAssets(bindings, { status: "failed", ...PAGE }),
    listAssets(bindings, { status: "processing", ...PAGE }),
    listAssets(bindings, { status: "pending", ...PAGE }),
  ]);

  return {
    failed: failed.items,
    // 处理中在前（更接近完成），待处理在后。
    inFlight: [...processing.items, ...pending.items],
    counts: {
      failed: failed.pagination.total,
      processing: processing.pagination.total,
      pending: pending.pagination.total,
    },
  };
};
