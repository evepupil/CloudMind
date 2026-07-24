import type { AssetSummary } from "@/features/assets/model/types";

export const agentMemoryInputClass =
  "w-full rounded-md border border-line bg-ink-raised px-3 py-2 text-[14px] text-bone outline-none transition-colors focus:border-brass";

export const formatMemoryDate = (value: string | null): string =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "N/A";

export const formatMemoryContext = (contextKey: string): string =>
  contextKey === "global" ? "全局" : contextKey.replace(/^project:/, "");

export const getMemoryVersionState = (item: AssetSummary) => {
  if (item.deletedAt) {
    return { status: "failed" as const, label: "已遗忘" };
  }
  if (item.supersededAt) {
    return { status: "pending" as const, label: "历史版本" };
  }
  if (item.status !== "ready") {
    return { status: item.status, label: "候选版本" };
  }

  return { status: "ready" as const, label: "当前版本" };
};
