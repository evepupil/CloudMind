import { PageShell } from "@/features/layout/components/page-shell";
import type { MemoryManagementListView } from "@/features/memory/server/management-service";
import { FlashMessage } from "@/features/ui/components";
import { AgentMemoryFilters } from "./agent-memory-filters";
import { AgentMemoryProjectView } from "./agent-memory-project-view";
import { AgentMemoryRecordList } from "./agent-memory-record-list";

export const AgentMemoryPage = ({
  view,
  errorMessage,
  flashMessage,
}: {
  view: MemoryManagementListView;
  errorMessage?: string | undefined;
  flashMessage?: string | undefined;
}) => (
  <PageShell
    navigationKey="agent-memory"
    eyebrow="记忆层 · Agent 管理"
    title={
      <>
        记忆<em class="italic text-brass">控制台</em>
      </>
    }
    subtitle="按记录类型、记忆归属和项目上下文筛选；查看来源与版本，并执行专用的更新、遗忘和恢复。"
  >
    {flashMessage ? (
      <FlashMessage kind="success" class="mb-4">
        {flashMessage}
      </FlashMessage>
    ) : null}
    {errorMessage ? (
      <FlashMessage kind="error" class="mb-4">
        {errorMessage}
      </FlashMessage>
    ) : null}

    <AgentMemoryFilters view={view} />
    <div class="grid gap-5 lg:grid-cols-[minmax(220px,0.34fr)_minmax(0,1fr)]">
      <AgentMemoryProjectView view={view} />
      <AgentMemoryRecordList view={view} />
    </div>
  </PageShell>
);
