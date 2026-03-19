import type { AssetStatus } from "@/features/assets/model/types";

const statusStyles: Record<
  AssetStatus,
  { backgroundColor: string; color: string; label: string }
> = {
  pending: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
    label: "Pending",
  },
  processing: {
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    label: "Processing",
  },
  ready: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    label: "Ready",
  },
  failed: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    label: "Failed",
  },
};

// 这里统一状态 badge 的视觉样式，避免列表页和详情页重复维护映射。
export const AssetStatusBadge = ({ status }: { status: AssetStatus }) => {
  const style = statusStyles[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: "999px",
        backgroundColor: style.backgroundColor,
        color: style.color,
        fontSize: "12px",
        fontWeight: 700,
        letterSpacing: "0.02em",
      }}
    >
      {style.label}
    </span>
  );
};
