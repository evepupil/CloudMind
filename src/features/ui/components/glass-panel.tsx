import type { Child } from "hono/jsx";

// Observatory 面板分档：
// - panel：标准内容面板（ink-panel 底 + 内高光 + 外柔阴影）
// - raised：抬升面（ink-raised，用于面板内嵌套小块/输入底）
// - bare：仅描边无填充（轻量分组）
export type PanelVariant = "panel" | "raised" | "bare";

const variantSurface: Record<PanelVariant, string> = {
  panel: "bg-ink-panel border-line",
  raised: "bg-ink-raised border-line",
  bare: "bg-transparent border-line",
};

// 内容面板基底。内顶部高光发丝线（inset shadow）+ 外柔分层阴影，营造悬浮。
// style 透传用于进场错峰动画（animation-delay）。
export const Panel = ({
  children,
  variant = "panel",
  class: className,
  style,
}: {
  children: Child;
  variant?: PanelVariant;
  class?: string;
  style?: string | undefined;
}) => (
  <div
    class={`rounded-lg border shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03),0_18px_50px_rgba(0,0,0,0.4)] ${variantSurface[variant]} ${className ?? ""}`}
    style={style}
  >
    {children}
  </div>
);

// 向后兼容别名（迁移期内旧引用仍可用；新代码用 Panel）。
export const GlassPanel = Panel;
export type GlassVariant = PanelVariant;
