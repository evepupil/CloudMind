import type { Child, JSX } from "hono/jsx";

export type ButtonVariant = "primary" | "subtle" | "ghost" | "danger";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-[14px] font-medium no-underline outline-none transition-colors duration-150 ease-glass focus-visible:ring-2 focus-visible:ring-accent-soft disabled:pointer-events-none disabled:opacity-50";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: `${buttonBase} bg-accent text-on-accent shadow-sm hover:bg-accent-hover`,
  subtle: `${buttonBase} border border-glass-border bg-glass-raised text-ink hover:border-glass-border-soft`,
  ghost: `${buttonBase} text-ink-soft hover:bg-glass-chrome-hover hover:text-ink`,
  danger: `${buttonBase} border border-status-failed-border bg-status-failed-bg text-status-failed-text hover:bg-glass-chrome-hover`,
};

// 取按钮样式类——给 <a> 链接复用同一套玻璃按钮外观（导航型链接很多，统一观感）。
export const buttonClass = (variant: ButtonVariant = "subtle"): string =>
  buttonVariants[variant];

// 真实 <button> 元素；需要链接时请用 <a class={buttonClass(...)}>。
export const Button = ({
  children,
  variant = "subtle",
  class: className,
  ...rest
}: JSX.IntrinsicElements["button"] & {
  variant?: ButtonVariant;
  children?: Child;
}) => (
  <button class={`${buttonVariants[variant]} ${className ?? ""}`} {...rest}>
    {children}
  </button>
);
