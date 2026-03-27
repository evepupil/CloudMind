import type { AssetStatus } from "@/features/assets/model/types";

const statusStyles: Record<AssetStatus, { class: string; label: string }> = {
  pending: {
    class: "bg-[#f9f3e3] text-[#7c6a2e] border-[#e8dbb7]",
    label: "Pending",
  },
  processing: {
    class: "bg-[#e3eef9] text-[#2e6a9c] border-[#b7d4e8]",
    label: "Processing",
  },
  ready: {
    class: "bg-[#e3f2e8] text-[#2e6c3e] border-[#b7dbbf]",
    label: "Ready",
  },
  failed: {
    class: "bg-[#f9e3e3] text-[#9c2e2e] border-[#e8b7b7]",
    label: "Failed",
  },
};

// Notion 风格状态 badge：小圆角、低饱和色、微边框。
export const AssetStatusBadge = ({ status }: { status: AssetStatus }) => {
  const s = statusStyles[status];

  return (
    <span
      class={`inline-flex items-center px-2 py-0.5 text-[12px] font-medium rounded border ${s.class}`}
    >
      {s.label}
    </span>
  );
};
