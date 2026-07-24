import type { MemoryManagementListView } from "@/features/memory/server/management-service";
import {
  buttonClass,
  EmptyState,
  Panel,
  StatusBadge,
} from "@/features/ui/components";
import { buildAgentMemoryListHref } from "./agent-memory-project-view";
import {
  formatMemoryContext,
  formatMemoryDate,
  getMemoryVersionState,
} from "./agent-memory-view";

export const AgentMemoryRecordList = ({
  view,
}: {
  view: MemoryManagementListView;
}) => {
  const previousPage =
    view.pagination.page > 1 ? view.pagination.page - 1 : null;
  const nextPage =
    view.pagination.page < view.pagination.totalPages
      ? view.pagination.page + 1
      : null;

  return (
    <section class="min-w-0">
      <div class="mb-3 flex flex-wrap items-baseline gap-2">
        <span class="font-display text-[26px] font-medium tabular-nums text-brass">
          {view.pagination.total}
        </span>
        <span class="text-[13px] text-bone-soft">条符合条件的记录</span>
        <span class="font-mono text-[11px] text-bone-faint">
          第 {view.pagination.page} / {Math.max(1, view.pagination.totalPages)}{" "}
          页
        </span>
      </div>

      {view.items.length === 0 ? (
        <EmptyState
          title="没有符合条件的记录"
          description="调整三个维度或记录状态后再试。Agent 记忆由 remember_agent 写入。"
        />
      ) : (
        <div class="flex flex-col gap-3">
          {view.items.map((item) => {
            const state = getMemoryVersionState(item);
            const href =
              item.recordKind === "memory"
                ? `/memory/agent/${item.id}`
                : `/assets/${item.id}`;

            return (
              <Panel key={item.id} class="p-5" variant="panel">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="mb-2 flex flex-wrap gap-1.5 font-mono text-[10.5px]">
                      <span class="rounded bg-ink-raised px-2 py-0.5 text-bone-soft">
                        {item.recordKind}
                      </span>
                      <span class="rounded bg-ink-raised px-2 py-0.5 text-bone-soft">
                        {item.scopeId}
                      </span>
                      <span class="max-w-full truncate rounded bg-ink-raised px-2 py-0.5 text-bone-soft">
                        {formatMemoryContext(item.contextKey)}
                      </span>
                      {item.memoryVersion ? (
                        <span class="rounded bg-ink-raised px-2 py-0.5 text-bone-soft">
                          v{item.memoryVersion}
                        </span>
                      ) : null}
                    </div>
                    <a
                      href={href}
                      class="text-[16px] font-semibold text-bone no-underline transition-colors hover:text-brass"
                    >
                      {item.title}
                    </a>
                  </div>
                  <StatusBadge status={state.status} label={state.label} />
                </div>
                <p class="mt-2 text-[14px] leading-relaxed text-bone-soft">
                  {item.summary ?? "摘要尚未生成。"}
                </p>
                <div class="mt-3 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-bone-faint">
                  <span>更新于 {formatMemoryDate(item.updatedAt)}</span>
                  <a
                    href={href}
                    class="font-sans text-[13px] font-semibold text-brass no-underline hover:text-brass-bright"
                  >
                    {item.recordKind === "memory" ? "管理记忆" : "查看资产"} →
                  </a>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {previousPage || nextPage ? (
        <nav class="mt-5 flex items-center justify-between gap-3">
          {previousPage ? (
            <a
              href={buildAgentMemoryListHref(view, { page: previousPage })}
              class={buttonClass("subtle")}
            >
              ← 上一页
            </a>
          ) : (
            <span />
          )}
          {nextPage ? (
            <a
              href={buildAgentMemoryListHref(view, { page: nextPage })}
              class={buttonClass("subtle")}
            >
              下一页 →
            </a>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
};
