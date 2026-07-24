import type { RecordContextSummary } from "@/core/assets/ports";
import type { MemoryManagementListView } from "@/features/memory/server/management-service";
import { formatMemoryContext } from "./agent-memory-view";

const appendValues = (
  params: URLSearchParams,
  key: string,
  values: readonly string[] | undefined
): void => {
  for (const value of values ?? []) {
    params.append(key, value);
  }
};

export const buildAgentMemoryListHref = (
  view: MemoryManagementListView,
  overrides: {
    page?: number | undefined;
    contextKey?: string | null | undefined;
  } = {}
): string => {
  const params = new URLSearchParams();
  appendValues(params, "recordKinds", view.filters.recordKinds);
  appendValues(params, "scopeIds", view.filters.scopeIds);
  const selectedContexts =
    overrides.contextKey === undefined
      ? view.filters.contextKeys
      : overrides.contextKey
        ? [overrides.contextKey]
        : undefined;
  appendValues(params, "contextKeys", selectedContexts);

  if (view.filters.deleted) {
    params.set("deleted", view.filters.deleted);
  }
  if (view.filters.query) {
    params.set("query", view.filters.query);
  }
  params.set("page", String(overrides.page ?? view.filters.page ?? 1));
  params.set("pageSize", String(view.filters.pageSize ?? 20));

  return `/memory/agent?${params.toString()}`;
};

const ContextRow = ({
  context,
  active,
  href,
}: {
  context: RecordContextSummary;
  active: boolean;
  href: string;
}) => (
  <a
    href={href}
    class={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-line-soft px-1 py-3 no-underline last:border-none ${
      active ? "text-brass" : "text-bone hover:text-brass"
    }`}
  >
    <div class="min-w-0">
      <div class="truncate text-[14px] font-semibold">
        {formatMemoryContext(context.contextKey)}
      </div>
      <div class="mt-1 font-mono text-[10.5px] text-bone-faint">
        personal {context.personalCount} · agent {context.agentCount}
      </div>
    </div>
    <div class="self-center text-right font-mono text-[11px] text-bone-soft">
      <div>{context.activeCount} 条</div>
      {context.forgottenCount > 0 ? (
        <div class="mt-1 text-bone-faint">遗忘 {context.forgottenCount}</div>
      ) : null}
    </div>
  </a>
);

export const AgentMemoryProjectView = ({
  view,
}: {
  view: MemoryManagementListView;
}) => {
  const selectedContext = view.filters.contextKeys?.[0];

  return (
    <section>
      <div class="mb-3 flex items-baseline justify-between gap-3">
        <h2 class="font-display text-[18px] font-semibold text-bone">
          项目视图
        </h2>
        {selectedContext ? (
          <a
            href={buildAgentMemoryListHref(view, {
              contextKey: null,
              page: 1,
            })}
            class="text-[12px] text-bone-soft no-underline hover:text-brass"
          >
            查看全部
          </a>
        ) : null}
      </div>
      <div class="border-y border-line-soft">
        {view.contexts.length === 0 ? (
          <p class="py-4 text-[13px] text-bone-soft">暂无项目记录。</p>
        ) : (
          view.contexts.map((context) => (
            <ContextRow
              key={context.contextKey}
              context={context}
              active={selectedContext === context.contextKey}
              href={buildAgentMemoryListHref(view, {
                contextKey: context.contextKey,
                page: 1,
              })}
            />
          ))
        )}
      </div>
    </section>
  );
};
