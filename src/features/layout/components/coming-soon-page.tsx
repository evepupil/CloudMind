import type { NavigationKey } from "@/features/layout/components/app-shell";
import { PageShell } from "@/features/layout/components/page-shell";
import { buttonClass, EmptyState } from "@/features/ui/components";

// 「即将上线」占位页：记忆层区（Phase 5）与活动页（Phase 6）尚未落地，
// 先给导航一个有意义的落点，而非死链 404。
export const ComingSoonPage = ({
  navigationKey,
  eyebrow,
  title,
  phase,
  description,
}: {
  navigationKey: NavigationKey;
  eyebrow: string;
  title: string;
  phase: string;
  description: string;
}) => (
  <PageShell
    navigationKey={navigationKey}
    eyebrow={eyebrow}
    title={title}
    subtitle={description}
  >
    <EmptyState
      title={`${phase} · 即将上线`}
      description="后端能力已就绪，界面正在建设中。可先回到纵览或记忆库。"
      action={
        <div class="flex gap-2.5">
          <a class={buttonClass("subtle")} href="/">
            返回纵览
          </a>
          <a class={buttonClass("primary")} href="/assets">
            去记忆库
          </a>
        </div>
      }
    />
  </PageShell>
);
