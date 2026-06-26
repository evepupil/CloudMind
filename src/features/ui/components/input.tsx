import type { JSX } from "hono/jsx";

// Observatory 文本输入：抬升暗底、聚焦时黄铜描边 + 软辉。
export const Input = ({
  class: className,
  ...rest
}: JSX.IntrinsicElements["input"]) => (
  <input
    class={`w-full rounded-md border border-line bg-ink-raised px-3 py-2 text-[14px] text-bone outline-none transition-colors duration-150 ease-glass placeholder:text-bone-faint focus:border-brass focus:ring-2 focus:ring-brass-soft ${className ?? ""}`}
    {...rest}
  />
);

// 多行文本：同 Input 的外观。
export const Textarea = ({
  class: className,
  ...rest
}: JSX.IntrinsicElements["textarea"]) => (
  <textarea
    class={`w-full rounded-md border border-line bg-ink-raised px-3 py-2 text-[14px] leading-relaxed text-bone outline-none transition-colors duration-150 ease-glass placeholder:text-bone-faint focus:border-brass focus:ring-2 focus:ring-brass-soft ${className ?? ""}`}
    {...rest}
  />
);
