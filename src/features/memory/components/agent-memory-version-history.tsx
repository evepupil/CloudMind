import type { ManagedMemoryDetailView } from "@/features/memory/server/management-service";
import { StatusBadge } from "@/features/ui/components";
import { formatMemoryDate, getMemoryVersionState } from "./agent-memory-view";

export const AgentMemoryVersionHistory = ({
  view,
}: {
  view: ManagedMemoryDetailView;
}) => (
  <section>
    <h2 class="mb-3 font-display text-[19px] font-semibold text-bone">
      版本历史
    </h2>
    <div class="border-y border-line-soft">
      {view.versions.map((version) => {
        const state = getMemoryVersionState(version);
        return (
          <a
            key={version.id}
            href={`/memory/agent/${version.id}`}
            class={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-line-soft py-3 no-underline last:border-none ${
              version.id === view.item.id
                ? "text-brass"
                : "text-bone hover:text-brass"
            }`}
          >
            <div class="min-w-0">
              <div class="truncate text-[14px] font-semibold">
                v{version.memoryVersion ?? 1} · {version.title}
              </div>
              <div class="mt-1 font-mono text-[10.5px] text-bone-faint">
                {formatMemoryDate(version.createdAt)} · {version.id}
              </div>
            </div>
            <StatusBadge
              status={state.status}
              label={state.label}
              class="self-center"
            />
          </a>
        );
      })}
    </div>
  </section>
);
