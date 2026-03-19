import type { Child } from "hono/jsx";

import {
  AppShell,
  type NavigationKey,
} from "@/features/layout/components/app-shell";
import { PageHeader } from "@/features/layout/components/page-header";

// 这里封装页面级布局，让各页直接复用统一工作台壳层和页头。
export const PageShell = ({
  children,
  title,
  subtitle,
  navigationKey,
  actions,
}: {
  children: Child;
  title: string;
  subtitle: string;
  navigationKey: NavigationKey;
  actions?: Child | undefined;
}) => {
  return (
    <AppShell navigationKey={navigationKey}>
      <main
        style={{
          maxWidth: "1320px",
          margin: "0 auto",
        }}
      >
        <PageHeader title={title} subtitle={subtitle} actions={actions} />
        {children}
      </main>
    </AppShell>
  );
};
