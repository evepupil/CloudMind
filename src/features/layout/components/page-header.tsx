import type { Child } from "hono/jsx";

// Observatory 页头：Fraunces 衬线大标题 + 黄铜 eyebrow + 可选操作区。
// title 支持传 JSX（用 <em class="italic text-brass"> 做斜体黄铜强调）。
export const PageHeader = ({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: Child;
  subtitle?: string | undefined;
  eyebrow?: string | undefined;
  actions?: Child | undefined;
}) => {
  return (
    <header class="mb-8 flex items-end justify-between gap-6">
      <div class="min-w-0">
        {eyebrow ? (
          <p class="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-brass">
            {eyebrow}
          </p>
        ) : null}
        <h1 class="font-display text-[44px] font-medium leading-[1.02] tracking-tight text-bone">
          {title}
        </h1>
        {subtitle ? (
          <p class="mt-3.5 max-w-[56ch] text-[15px] leading-relaxed text-bone-soft">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div class="flex flex-shrink-0 flex-wrap items-center gap-2.5">
          {actions}
        </div>
      ) : null}
    </header>
  );
};
