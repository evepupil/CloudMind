import { PageShell } from "@/features/layout/components/page-shell";
import type { ManagedMemoryDetailView } from "@/features/memory/server/management-service";
import {
  buttonClass,
  FlashMessage,
  Panel,
  StatusBadge,
} from "@/features/ui/components";
import { AgentMemoryLifecyclePanel } from "./agent-memory-lifecycle-panel";
import { AgentMemoryMetadataPanels } from "./agent-memory-metadata-panels";
import { AgentMemoryVersionHistory } from "./agent-memory-version-history";
import {
  formatMemoryContext,
  getMemoryVersionState,
} from "./agent-memory-view";

export const AgentMemoryDetailPage = ({
  view,
  errorMessage,
  flashMessage,
}: {
  view?: ManagedMemoryDetailView | undefined;
  errorMessage?: string | undefined;
  flashMessage?: string | undefined;
}) => {
  if (!view) {
    return (
      <PageShell
        navigationKey="agent-memory"
        eyebrow="记忆层 · Agent 管理"
        title="记忆详情"
        subtitle="查看一条记忆的来源、版本和生命周期状态。"
        actions={
          <a href="/memory/agent" class={buttonClass("subtle")}>
            ← 返回控制台
          </a>
        }
      >
        <FlashMessage kind="error">
          {errorMessage ?? "未找到该记忆。"}
        </FlashMessage>
      </PageShell>
    );
  }

  const { item } = view;
  const state = getMemoryVersionState(item);

  return (
    <PageShell
      navigationKey="agent-memory"
      eyebrow="记忆层 · Agent 管理 / 详情"
      title={item.title}
      subtitle={`${item.scopeId} · ${formatMemoryContext(item.contextKey)} · 版本 v${item.memoryVersion ?? 1}`}
      actions={
        <a href="/memory/agent" class={buttonClass("subtle")}>
          ← 返回控制台
        </a>
      }
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

      <div class="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={state.status} label={state.label} />
        <span class="rounded bg-ink-raised px-2 py-0.5 font-mono text-[11px] text-bone-soft">
          {item.recordKind}
        </span>
        <span class="rounded bg-ink-raised px-2 py-0.5 font-mono text-[11px] text-bone-soft">
          {item.scopeId}
        </span>
        <span class="max-w-full rounded bg-ink-raised px-2 py-0.5 font-mono text-[11px] text-bone-soft">
          {item.contextKey}
        </span>
      </div>

      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.48fr)]">
        <div class="flex min-w-0 flex-col gap-4">
          <Panel class="p-6" variant="panel">
            <h2 class="mb-3 font-display text-[19px] font-semibold text-bone">
              记忆内容
            </h2>
            <pre class="m-0 whitespace-pre-wrap break-words font-mono text-[13px] leading-[1.8] text-bone-soft">
              {item.contentText ?? item.summary ?? "内容尚未生成。"}
            </pre>
          </Panel>
          <AgentMemoryVersionHistory view={view} />
        </div>

        <aside class="flex flex-col gap-4">
          <AgentMemoryLifecyclePanel view={view} />
          <AgentMemoryMetadataPanels item={item} />
        </aside>
      </div>
    </PageShell>
  );
};
