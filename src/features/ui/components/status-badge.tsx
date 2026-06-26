export type StatusKind = "pending" | "processing" | "ready" | "failed";

const statusStyles: Record<StatusKind, string> = {
  pending:
    "border-status-pending-border bg-status-pending-bg text-status-pending",
  processing:
    "border-status-processing-border bg-status-processing-bg text-status-processing",
  ready: "border-status-ready-border bg-status-ready-bg text-status-ready",
  failed: "border-status-failed-border bg-status-failed-bg text-status-failed",
};

const statusLabels: Record<StatusKind, string> = {
  pending: "待处理",
  processing: "处理中",
  ready: "就绪",
  failed: "失败",
};

// 状态药丸：JetBrains Mono 小字 + 圆角描边，玉绿/钢蓝/黄铜/铁锈四态。
export const StatusBadge = ({
  status,
  label,
  class: className,
}: {
  status: StatusKind;
  label?: string;
  class?: string;
}) => (
  <span
    class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] ${statusStyles[status]} ${className ?? ""}`}
  >
    <span class="h-1.5 w-1.5 rounded-full bg-current" />
    {label ?? statusLabels[status]}
  </span>
);
