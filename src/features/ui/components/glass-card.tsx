import type { Child } from "hono/jsx";

import { GlassPanel, type GlassVariant } from "./glass-panel";

// 卡片：带内边距的玻璃容器；interactive 时给 hover 态（列表项/可点击块）。
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
    class={`${padded ? "p-5" : ""} ${interactive ? "cursor-pointer transition-colors duration-150 ease-glass hover:border-glass-border hover:shadow-lg" : ""} ${className ?? ""}`}
  >
    {children}
  </GlassPanel>
);
