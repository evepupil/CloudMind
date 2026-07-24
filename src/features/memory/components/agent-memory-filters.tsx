import type { Child } from "hono/jsx";

import type { RecordKind } from "@/core/records/classification";
import type { MemoryManagementListView } from "@/features/memory/server/management-service";
import { buttonClass, Panel } from "@/features/ui/components";
import {
  agentMemoryInputClass,
  formatMemoryContext,
} from "./agent-memory-view";

const Field = ({ label, children }: { label: string; children: Child }) => (
  // biome-ignore lint/a11y/noLabelWithoutControl: children 始终是表单控件。
  <label class="grid gap-1.5">
    <span class="text-[12px] font-medium text-bone-soft">{label}</span>
    {children}
  </label>
);

export const AgentMemoryFilters = ({
  view,
}: {
  view: MemoryManagementListView;
}) => {
  const selectedContext = view.filters.contextKeys?.[0];

  return (
    <Panel class="mb-5 p-5" variant="panel">
      <form
        method="get"
        action="/memory/agent"
        class="grid gap-4 lg:grid-cols-[1fr_1fr_minmax(220px,1.2fr)_minmax(180px,0.8fr)]"
      >
        <fieldset class="grid content-start gap-2">
          <legend class="mb-1 text-[12px] font-medium text-bone-soft">
            记录类型
          </legend>
          {(["library", "memory"] satisfies RecordKind[]).map((kind) => (
            <label
              key={kind}
              class="flex items-center gap-2 text-[14px] text-bone"
            >
              <input
                type="checkbox"
                name="recordKinds"
                value={kind}
                checked={view.filters.recordKinds?.includes(kind)}
                class="size-4 accent-brass"
              />
              {kind === "memory" ? "长期记忆" : "知识资料"}
            </label>
          ))}
        </fieldset>

        <fieldset class="grid content-start gap-2">
          <legend class="mb-1 text-[12px] font-medium text-bone-soft">
            记忆归属
          </legend>
          {(["personal", "agent"] as const).map((scopeId) => (
            <label
              key={scopeId}
              class="flex items-center gap-2 text-[14px] text-bone"
            >
              <input
                type="checkbox"
                name="scopeIds"
                value={scopeId}
                checked={view.filters.scopeIds?.includes(scopeId)}
                class="size-4 accent-brass"
              />
              {scopeId === "agent" ? "Agent 工作记忆" : "个人记忆"}
            </label>
          ))}
        </fieldset>

        <div class="grid gap-3">
          <Field label="项目上下文">
            <select
              name="contextKeys"
              value={selectedContext ?? ""}
              class={agentMemoryInputClass}
            >
              <option value="">全部项目</option>
              {view.contexts.map((context) => (
                <option key={context.contextKey} value={context.contextKey}>
                  {formatMemoryContext(context.contextKey)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="记录状态">
            <select
              name="deleted"
              value={view.filters.deleted ?? "exclude"}
              class={agentMemoryInputClass}
            >
              <option value="exclude">当前记录</option>
              <option value="only">已遗忘</option>
              <option value="include">全部状态</option>
            </select>
          </Field>
        </div>

        <div class="grid content-start gap-3">
          <Field label="标题或摘要">
            <input
              type="search"
              name="query"
              value={view.filters.query ?? ""}
              placeholder="M3、检索决策..."
              class={agentMemoryInputClass}
            />
          </Field>
          <div class="flex flex-wrap gap-2">
            <button type="submit" class={buttonClass("primary")}>
              应用筛选
            </button>
            <a href="/memory/agent" class={buttonClass("subtle")}>
              重置
            </a>
          </div>
        </div>
      </form>
    </Panel>
  );
};
