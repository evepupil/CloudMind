import type { Child, JSX } from "hono/jsx";

// Observatory 按钮：黄铜金主操作 + 描边次操作 + 幽灵 + 危险。
// 主按钮带内高光 + 外黄铜辉，focus 用 outline-ring（不挤布局），active 微位移。
export type ButtonVariant = "primary" | "subtle" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-md px-3 text-[13px]",
  md: "h-9 gap-2 rounded-md px-4 text-[14px]",
  lg: "h-11 gap-2 rounded-lg px-6 text-[15px]",
  icon: "h-9 w-9 rounded-md",
};

const buttonBase = [
  "inline-flex select-none items-center justify-center whitespace-nowrap font-medium no-underline",
  "outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-glass",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass",
  "active:translate-y-px",
  "disabled:pointer-events-none disabled:opacity-50",
  "[&>svg]:pointer-events-none [&>svg]:size-4 [&>svg]:shrink-0",
].join(" ");

const variantClasses: Record<ButtonVariant, string> = {
  // 主操作：黄铜金实心 + 内高光 + 外黄铜辉，hover 提亮。
  primary:
    "bg-brass text-on-brass shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),0_6px_20px_rgba(201,163,94,0.22)] hover:bg-brass-bright",
  // 次操作：描边 + 暖底，hover 边框转黄铜。
  subtle:
    "border border-line bg-ink-raised text-bone-soft hover:border-brass/40 hover:text-bone",
  // 幽灵：无边无底，hover 浮一层暖光。
  ghost: "text-bone-soft hover:bg-[rgba(236,228,212,0.04)] hover:text-bone",
  // 危险：铁锈调 + 锈边。
  danger:
    "border border-status-failed-border bg-status-failed-bg text-status-failed hover:bg-[rgba(193,123,90,0.14)]",
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
