import type { Child } from "hono/jsx";

// 玻璃面分档：正文区一律 reading/raised（高不透明度，保 WCAG AA）；
// chrome 用于侧栏/页头等装饰外壳，可更通透让极光透出。
export type GlassVariant = "reading" | "raised" | "chrome";

const variantSurface: Record<GlassVariant, string> = {
  reading: "bg-glass-reading border-glass-border",
  raised: "bg-glass-raised border-glass-border",
  chrome: "bg-glass-chrome border-glass-border-soft",
};

// 磨砂玻璃容器——所有内容面板的基底。可读性铁律：正文落 reading/raised。
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
    class={`border rounded-lg shadow-md ${frosted ? "backdrop-blur-xl" : ""} ${variantSurface[variant]} ${className ?? ""}`}
  >
    {children}
  </div>
);
