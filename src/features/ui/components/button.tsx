import type { Child, JSX } from "hono/jsx";

// 配方取自 Tailwind Catalyst 深色按钮的 class 组合，适配 Glass/Aurora 令牌：
// 多层阴影（外阴影 + 内高光边）、focus 用 outline-ring（不挤布局）、active 微位移、
// 大小分级。比手搓单层 hover 更精致，且零 JS 运行时。
export type ButtonVariant = "primary" | "subtle" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-md px-3 text-[13px]",
  md: "h-9 gap-2 rounded-md px-4 text-[14px]",
  lg: "h-11 gap-2 rounded-lg px-6 text-[15px]",
  icon: "h-9 w-9 rounded-md",
};

// Catalyst 深色基底：内高光 + 外阴影 + focus outline ring + active 压缩。
const buttonBase = [
  "inline-flex select-none items-center justify-center whitespace-nowrap font-medium",
  "outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-glass",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  "active:translate-y-px",
  "disabled:pointer-events-none disabled:opacity-50",
  "[&>svg]:pointer-events-none [&>svg]:size-4 [&>svg]:shrink-0",
].join(" ");

const variantClasses: Record<ButtonVariant, string> = {
  // 主操作：冰青实心 + 内高光 + 外柔阴影，hover 提亮、active 压暗。
  primary:
    "bg-accent text-on-accent shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_1px_2px_0_rgba(0,0,0,0.3)] hover:bg-accent-hover",
  // 次操作：玻璃面 + 发丝边 + hover 边框变亮。
  subtle:
    "border border-glass-border bg-glass-raised text-ink shadow-sm backdrop-blur-xl hover:border-glass-border-soft hover:bg-glass-chrome-hover",
  // 幽灵：无边无底，hover 浮一层。
  ghost: "text-ink-soft hover:bg-glass-chrome-hover hover:text-ink",
  // 危险：玻璃红调 + 红边。
  danger:
    "border border-status-failed-border bg-status-failed-bg text-status-failed-text backdrop-blur-xl hover:bg-glass-chrome-hover",
};

const resolveClasses = (
  variant: ButtonVariant,
  size: ButtonSize,
  className?: string | Promise<string>
): string =>
  `${buttonBase} ${sizeClasses[size]} ${variantClasses[variant]} ${className ?? ""}`;

// 取按钮样式类——给 <a> 链接复用同一套按钮外观（导航型链接多，统一观感）。
export const buttonClass = (
  variant: ButtonVariant = "subtle",
  size: ButtonSize = "md",
  className?: string | Promise<string>
): string => resolveClasses(variant, size, className);

// 真实 <button> 元素；需要链接时请用 <a class={buttonClass(...)}>。
export const Button = ({
  children,
  variant = "subtle",
  size = "md",
  class: className,
  ...rest
}: JSX.IntrinsicElements["button"] & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: Child;
}) => (
  <button class={resolveClasses(variant, size, className)} {...rest}>
    {children}
  </button>
);
