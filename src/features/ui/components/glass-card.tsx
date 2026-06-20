import type { Child } from "hono/jsx";

import { GlassPanel, type GlassVariant } from "./glass-panel";

// 卡片：带内边距的玻璃容器；interactive 时给 Catalyst 风格 hover 态
// （边框变亮 + 阴影加深 + 轻微上浮），用于列表项/可点击块。
export const GlassCard = ({
  children,
  variant = "raised",
  interactive = false,
  padded = true,
  class: className,
}: {
  children: Child;
  variant?: GlassVariant;
  interactive?: boolean;
  padded?: boolean;
  class?: string;
}) => (
  <GlassPanel
    variant={variant}
    class={`${padded ? "p-5" : ""} ${interactive ? "cursor-pointer transition-[border-color,box-shadow,transform] duration-150 ease-glass hover:-translate-y-0.5 hover:border-glass-border-soft hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_20px_50px_rgba(0,0,0,0.45)]" : ""} ${className ?? ""}`}
  >
    {children}
  </GlassPanel>
);
