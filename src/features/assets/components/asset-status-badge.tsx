import type { AssetStatus } from "@/features/assets/model/types";
import { StatusBadge } from "@/features/ui/components";

// 兼容旧引用：委托给 Observatory 统一 StatusBadge（玉绿/钢蓝/黄铜/铁锈四态 + 中文）。
export const AssetStatusBadge = ({ status }: { status: AssetStatus }) => (
  <StatusBadge status={status} />
);
