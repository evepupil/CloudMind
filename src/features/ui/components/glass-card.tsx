import type { Child } from "hono/jsx";

import { Panel, type PanelVariant } from "./glass-panel";

// 卡片：带内边距的面板；interactive 时给 hover 态
// （边框转黄铜暖调 + 阴影加深 + 轻微上浮），用于列表项/可点击块。
export const Card = ({
  children,
  variant = "raised",
  interactive = false,
  padded = true,
  class: className,
}: {
  children: Child;
  variant?: PanelVariant;
  interactive?: boolean;
  padded?: boolean;
  class?: string;
}) => (
  <Panel
    variant={variant}
    class={`${padded ? "p-5" : ""} ${interactive ? "cursor-pointer transition-[border-color,box-shadow,transform] duration-150 ease-glass hover:-translate-y-0.5 hover:border-brass/40 hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_22px_60px_rgba(0,0,0,0.5)]" : ""} ${className ?? ""}`}
  >
    {children}
  </Panel>
);

// 向后兼容别名（迁移期内旧引用仍可用；新代码用 Card）。
export const GlassCard = Card;
