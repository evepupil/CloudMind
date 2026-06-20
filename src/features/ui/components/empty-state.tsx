import type { Child } from "hono/jsx";

// 空状态：每种空态都给「这是什么 / 下一步动作」。透明底，落在父面板里。
export const EmptyState = ({
  title,
  description,
  action,
  icon,
  class: className,
}: {
  title: string;
  description?: string;
  action?: Child;
  icon?: Child;
  class?: string;
}) => (
  <div
    class={`flex flex-col items-center justify-center rounded-lg border border-dashed border-glass-border px-6 py-12 text-center ${className ?? ""}`}
  >
    {icon ? <div class="mb-3 text-ink-faint">{icon}</div> : null}
    <p class="text-[15px] font-medium text-ink">{title}</p>
    {description ? (
      <p class="mt-1.5 max-w-[42ch] text-[13px] leading-relaxed text-ink-soft">
        {description}
      </p>
    ) : null}
    {action ? <div class="mt-4">{action}</div> : null}
  </div>
);
