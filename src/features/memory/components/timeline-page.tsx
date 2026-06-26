import type { MemoryStatement } from "@/core/memory/ports";
import { PageShell } from "@/features/layout/components/page-shell";
import type { TimelineView } from "@/features/memory/server/memory-browse-service";
import { EmptyState, Panel, StatusBadge } from "@/features/ui/components";

const formatDate = (value: string | null): string => {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
};

const formatDay = (value: string): string => {
  return new Date(value).toLocaleDateString("zh-CN");
};

// 把陈述渲染成可读事实：subject —predicate→ object（实体名经 entityNames 映射）。
const renderFact = (
  statement: MemoryStatement,
  entityNames: Record<string, string>
): string => {
  const subject =
    entityNames[statement.subjectEntityId] ?? statement.subjectEntityId;
  const object = statement.objectEntityId
    ? (entityNames[statement.objectEntityId] ?? statement.objectEntityId)
    : (statement.objectLiteral ?? "");
  return `${subject} · ${statement.predicate}${object ? ` · ${object}` : ""}`;
};

export const TimelinePage = ({ view }: { view: TimelineView }) => {
  const { statements, entityNames, counts } = view;

  return (
    <PageShell
      navigationKey="timeline"
      eyebrow="记忆层 · 事实"
      title={
        <>
          事实 / <em class="italic text-brass">时间线</em>
        </>
      }
      subtitle="带双时间有效期的陈述，按时间轴铺开。失效的事实仍保留，可追溯每条记忆的生效与失效。"
    >
      <div class="mb-5 flex items-baseline gap-2">
        <span class="font-display text-[26px] font-medium tabular-nums text-brass">
          {counts.statements}
        </span>
        <span class="text-[13px] text-bone-soft">条活跃陈述</span>
      </div>

      {statements.length === 0 ? (
        <EmptyState
          title="还没有陈述"
          description="采集记忆后，处理流水线会从中抽取结构化事实，在此按时间线呈现。"
        />
      ) : (
        <Panel class="p-6" variant="panel">
          <div class="flex flex-col">
            {statements.map((statement) => {
              const expired = statement.expiredAt !== null;
              return (
                <div
                  key={statement.id}
                  class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-line-soft py-3.5 last:border-none"
                >
                  <div class="min-w-0">
                    <p
                      class={`text-[14.5px] font-medium ${expired ? "text-bone-faint line-through" : "text-bone"}`}
                    >
                      {renderFact(statement, entityNames)}
                    </p>
                    {statement.nlText ? (
                      <p class="mt-1 text-[13px] leading-relaxed text-bone-soft">
                        {statement.nlText}
                      </p>
                    ) : null}
                    <div class="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-bone-faint">
                      <span>建于 {formatDate(statement.createdAt)}</span>
                      {statement.validFrom ? (
                        <span>有效起 {formatDay(statement.validFrom)}</span>
                      ) : null}
                      {statement.validUntil ? (
                        <span>有效止 {formatDay(statement.validUntil)}</span>
                      ) : null}
                      {expired ? (
                        <span>失效于 {formatDate(statement.expiredAt)}</span>
                      ) : null}
                      {statement.accessCount > 0 ? (
                        <span>访问 {statement.accessCount}×</span>
                      ) : null}
                    </div>
                  </div>
                  <div class="self-start">
                    <StatusBadge
                      status={expired ? "failed" : "ready"}
                      label={expired ? "已失效" : "有效"}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </PageShell>
  );
};
