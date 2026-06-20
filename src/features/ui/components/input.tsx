import type { JSX } from "hono/jsx";

// 玻璃文本输入：暗底、聚焦时强调色描边 + 软光晕。
export const Input = ({
  class: className,
  ...rest
}: JSX.IntrinsicElements["input"]) => (
  <input
    class={`w-full rounded-md border border-glass-border bg-glass-raised px-3 py-2 text-[14px] text-ink outline-none transition-colors duration-150 ease-glass placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent-soft ${className ?? ""}`}
    {...rest}
  />
);

// 多行文本：同 Input 的玻璃外观。
export const Textarea = ({
  class: className,
  ...rest
}: JSX.IntrinsicElements["textarea"]) => (
  <textarea
    class={`w-full rounded-md border border-glass-border bg-glass-raised px-3 py-2 text-[14px] leading-relaxed text-ink outline-none transition-colors duration-150 ease-glass placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent-soft ${className ?? ""}`}
    {...rest}
  />
);
