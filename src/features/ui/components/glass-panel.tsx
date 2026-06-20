import type { Child } from "hono/jsx";

// 玻璃面分档：正文区一律 reading/raised（高不透明度，保 WCAG AA）；
// chrome 用于侧栏/页头等装饰外壳，可更通透让极光透出。
// 配方取自 Catalyst 深色卡片：内高光发丝边（inset）+ 外柔分层阴影 + 磨砂。
export type GlassVariant = "reading" | "raised" | "chrome";

const variantSurface: Record<GlassVariant, string> = {
  reading: "bg-glass-reading",
  raised: "bg-glass-raised",
  chrome: "bg-glass-chrome",
};

// 磨砂玻璃容器——所有内容面板的基底。可读性铁律：正文落 reading/raised。
// 内顶部高光发丝线（inset shadow）营造玻璃质感，外柔阴影分层悬浮。
export const GlassPanel = ({
  children,
  variant = "reading",
  frosted = true,
  class: className,
}: {
  children: Child;
  variant?: GlassVariant;
  frosted?: boolean;
  class?: string;
}) => (
  <div
    class={`rounded-lg border border-glass-border shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_10px_30px_rgba(0,0,0,0.35)] ${frosted ? "backdrop-blur-xl" : ""} ${variantSurface[variant]} ${className ?? ""}`}
  >
    {children}
  </div>
);
