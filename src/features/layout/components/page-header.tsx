import type { Child } from "hono/jsx";

// Notion 极简页面头部：无渐变、无大圆角、无 kicker，只有干净的标题和底线分隔。
export const PageHeader = ({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: Child | undefined;
}) => {
  return (
    <header class="flex items-end justify-between gap-5 pb-6 mb-6 border-b border-[#e8e8e7]">
      <div class="min-w-0">
        <h1 class="text-[36px] font-semibold text-[#37352f] leading-tight tracking-tight">
          {title}
        </h1>
        <p class="mt-2 max-w-[760px] text-[15px] text-[#787774] leading-relaxed">
          {subtitle}
        </p>
      </div>
      {actions ? (
        <div class="flex items-center gap-3 flex-wrap">{actions}</div>
      ) : null}
    </header>
  );
};
