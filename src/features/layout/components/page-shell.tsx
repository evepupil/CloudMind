import type { Child } from "hono/jsx";

import {
  AppShell,
  type NavigationKey,
} from "@/features/layout/components/app-shell";
import { PageHeader } from "@/features/layout/components/page-header";

// 页面级布局：统一工作台壳层 + 页头。title 支持 JSX（斜体黄铜强调）。
export const PageShell = ({
  children,
  title,
  subtitle,
  eyebrow,
  navigationKey,
  actions,
}: {
  children: Child;
  title: Child;
  subtitle?: string | undefined;
  eyebrow?: string | undefined;
  navigationKey: NavigationKey;
  actions?: Child | undefined;
}) => {
  return (
    <AppShell navigationKey={navigationKey}>
      <main class="mx-auto max-w-[1180px]">
        <PageHeader
          title={title}
          subtitle={subtitle}
          eyebrow={eyebrow}
          actions={actions}
        />
        {children}
      </main>
    </AppShell>
  );
};
