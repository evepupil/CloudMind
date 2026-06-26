import { PageShell } from "@/features/layout/components/page-shell";
import type { ConsolidationView } from "@/features/memory/server/memory-browse-service";
import { EmptyState, Panel } from "@/features/ui/components";

export const ConsolidationPage = ({ view }: { view: ConsolidationView }) => {
  const { driftedEdges, duplicateCount, counts, entityNames } = view;
  const allClean = driftedEdges.length === 0 && duplicateCount === 0;

  return (
    <PageShell
      navigationKey="consolidation"
      eyebrow="记忆层 · 整合"
      title={
        <>
          记忆<em class="italic text-brass">整合</em>
        </>
      }
      subtitle="sleep-time 整合的可观测面：每日 03:00 UTC 自动修复漂移边与重复陈述。这里是当前待办问题的实时快照。"
    >
      {/* 健康总览条 */}
      <div
        class={`mb-5 flex items-center gap-3.5 rounded-lg border px-5 py-4 ${
          allClean
            ? "border-status-ready-border bg-status-ready-bg"
            : "border-status-pending-border bg-status-pending-bg"
        }`}
      >
        <span
          class={`font-mono text-[18px] ${allClean ? "text-status-ready" : "text-status-pending"}`}
        >
          ◍
        </span>
        <div>
          <p class="text-[14px] font-medium text-bone">
            {allClean
              ? "图谱一致——没有待修复的问题"
              : `发现 ${driftedEdges.length} 条漂移边、${duplicateCount} 组重复陈述`}
          </p>
          <p class="mt-0.5 text-[12.5px] text-bone-soft">
            下次自动整合：每日 03:00 UTC · 当前活跃 {counts.statements} 陈述 /{" "}
            {counts.edges} 边
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 漂移边 */}
        <Panel class="p-6" variant="panel">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="font-display text-[18px] font-semibold text-bone">
              漂移边
            </h2>
            <span class="font-mono text-[12px] text-bone-faint">
              {driftedEdges.length}
            </span>
          </div>
          <p class="mb-4 text-[12.5px] leading-relaxed text-bone-soft">
            仍活跃、但已无任何活跃陈述支撑的关系边。下次整合会自动失效它们。
          </p>
          {driftedEdges.length === 0 ? (
            <EmptyState
              title="没有漂移边"
              description="所有关系边都有陈述支撑。"
            />
          ) : (
            <div class="flex flex-col">
              {driftedEdges.map((edge) => (
                <div
                  key={edge.id}
                  class="border-b border-line-soft py-2.5 last:border-none"
                >
                  <p class="font-mono text-[12.5px] text-bone">
                    {entityNames[edge.srcEntityId] ?? edge.srcEntityId}
                    <span class="text-brass"> —{edge.relation}→ </span>
                    {entityNames[edge.dstEntityId] ?? edge.dstEntityId}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* 重复陈述 */}
        <Panel class="p-6" variant="panel">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="font-display text-[18px] font-semibold text-bone">
              重复陈述
            </h2>
            <span class="font-mono text-[12px] text-bone-faint">
              {duplicateCount}
            </span>
          </div>
          <p class="mb-4 text-[12.5px] leading-relaxed text-bone-soft">
            同主语·谓语·宾语的多条活跃陈述。下次整合会保留最早一条、归档其余。
          </p>
          {duplicateCount === 0 ? (
            <EmptyState
              title="没有重复陈述"
              description="每条事实在图谱里都唯一。"
            />
          ) : (
            <div class="rounded-md border border-line bg-ink-raised px-4 py-3">
              <p class="text-[13px] text-bone-soft">
                检测到{" "}
                <span class="font-medium text-bone">{duplicateCount}</span>{" "}
                条冗余陈述待归档。
              </p>
            </div>
          )}
        </Panel>
      </div>
    </PageShell>
  );
};
