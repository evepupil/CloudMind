import type { Child } from "hono/jsx";

export type FlashKind = "success" | "error" | "info";

const flashStyles: Record<FlashKind, string> = {
  success:
    "border-status-ready-border bg-status-ready-bg text-status-ready-text",
  error:
    "border-status-failed-border bg-status-failed-bg text-status-failed-text",
  info: "border-status-processing-border bg-status-processing-bg text-status-processing-text",
};

// 一次性提示条（成功/错误/信息）。复用状态色保证语义一致；role=status 供辅助技术。
export const FlashMessage = ({
  kind = "info",
  children,
  class: className,
}: {
  kind?: FlashKind;
  children: Child;
  class?: string;
}) => (
  <div
    class={`rounded-md border px-4 py-3 text-[13px] leading-relaxed ${flashStyles[kind]} ${className ?? ""}`}
    role="status"
  >
    {children}
  </div>
);
