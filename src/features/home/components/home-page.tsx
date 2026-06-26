import type { AssetSummary } from "@/features/assets/model/types";
import type { OverviewSnapshot } from "@/features/home/server/overview-service";
import { PageShell } from "@/features/layout/components/page-shell";
import {
  buttonClass,
  EmptyState,
  Panel,
  StatusBadge,
  Textarea,
} from "@/features/ui/components";

// 建议追问（静态引导，点击跳问答页带上 question）。
const suggestedPrompts = [
  "我关于 scope 隔离做过哪些决策？",
  "提示词防火墙的核心机制是什么？",
  "最近一周我采集了哪些工程笔记？",
  "agent 记忆和人的记忆区别在哪？",
];

// 相对时间（简单版：天/小时/刚刚），SSR 友好。
const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.max(0, Math.round((now - then) / 60000));
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} 天前`;
};

const Metric = ({
  label,
  value,
  note,
  accent = false,
  spark,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
  spark?: string;
}) => (
  <div class="relative bg-ink-raised p-5">
    <p class="mb-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-bone-faint">
      {label}
    </p>
    <p
      class={`font-display text-[40px] font-medium leading-none tabular-nums ${accent ? "text-brass" : "text-bone"}`}
    >
      {value}
    </p>
    {spark ? (
      <span class="absolute right-4 top-5 font-mono text-[11px] text-status-ready">
        {spark}
      </span>
    ) : null}
    <p class="mt-2 text-[12px] text-bone-soft">{note}</p>
  </div>
);

const RecentAsset = ({
  asset,
  index,
}: {
  asset: AssetSummary;
  index: number;
}) => (
  <div class="flex items-start gap-3.5 border-b border-line-soft py-3.5 last:border-none">
    <span class="min-w-[22px] pt-0.5 font-mono text-[11px] text-bone-faint">
      {String(index + 1).padStart(2, "0")}
    </span>
    <div class="min-w-0 flex-1">
      <a
        href={`/assets/${asset.id}`}
        class="text-[14.5px] font-semibold leading-snug text-bone no-underline transition-colors hover:text-brass"
      >
        {asset.title}
      </a>
      <div class="mt-1 flex gap-3 font-mono text-[11px] text-bone-faint">
        <span>{asset.type}</span>
        <span>{asset.domain}</span>
        <span>{relativeTime(asset.createdAt)}</span>
      </div>
    </div>
    <div class="self-center">
      <StatusBadge status={asset.status} />
    </div>
  </div>
);

// Observatory 首页：真实计量 + 记忆图谱概览 + 最近采集 + 速记 + 建议问询 + 整合条。
export const HomePage = ({ snapshot }: { snapshot: OverviewSnapshot }) => {
  const { totalAssets, statusCounts, recentAssets, graphCounts } = snapshot;
  const processingTotal = statusCounts.pending + statusCounts.processing;

  return (
    <PageShell
      navigationKey="overview"
      eyebrow="MEMORY LAYER · 纵览"
      title={
        <>
          你的<em class="italic text-brass">记忆</em>当前状态
        </>
      }
      subtitle="一座私有、可导出、由你掌控的知识层。最近采集、处理动态、记忆图谱的生长，都在这里一眼可见。"
      actions={
        <>
          <a class={buttonClass("subtle")} href="/ask">
            ? 问答
          </a>
          <a class={buttonClass("primary")} href="/capture">
            + 采集
          </a>
        </>
      }
    >
      {/* 计量条 */}
      <section
        class="rise mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line-soft md:grid-cols-4"
        style="animation-delay: 0.08s"
      >
        <Metric
          label="资产"
          value={String(totalAssets)}
          note="L1 事实 / 情节"
        />
        <Metric
          label="处理中"
          value={String(processingTotal)}
          note="待处理 + 处理中"
          accent={processingTotal > 0}
        />
        <Metric
          label="就绪"
          value={String(statusCounts.ready)}
          note="可检索可追问"
          {...(statusCounts.ready > 0 ? { spark: "● ready" } : {})}
        />
        <Metric
          label="失败"
          value={String(statusCounts.failed)}
          note="需重处理"
          accent={statusCounts.failed > 0}
        />
      </section>

      {/* 主网格 */}
      <div class="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* 左列 */}
        <div class="flex flex-col gap-5">
          {/* 记忆图谱概览：真实计数（点击进图谱全图）+ 整合状态条 */}
          <Panel
            class="rise p-6"
            variant="panel"
            style="animation-delay: 0.16s"
          >
            <div class="mb-4 flex items-center justify-between">
              <h2 class="font-display text-[19px] font-semibold text-bone">
                记忆图谱
              </h2>
              <a
                href="/memory/graph"
                class="font-mono text-[11px] uppercase tracking-[0.08em] text-brass no-underline hover:text-brass-bright"
              >
                展开全图 →
              </a>
            </div>
            <div class="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line-soft">
              {[
                { label: "实体", value: graphCounts.entities },
                { label: "陈述", value: graphCounts.statements },
                { label: "关系边", value: graphCounts.edges },
              ].map((item) => (
                <a
                  key={item.label}
                  href="/memory/graph"
                  class="bg-ink-raised px-4 py-5 text-center no-underline transition-colors hover:bg-ink-panel"
                >
                  <div class="font-display text-[32px] font-medium tabular-nums text-brass">
                    {item.value}
                  </div>
                  <div class="mt-1 text-[12px] text-bone-soft">
                    {item.label}
                  </div>
                </a>
              ))}
            </div>
            <div class="mt-4 flex items-center gap-3.5 rounded-md border border-status-ready-border bg-status-ready-bg px-4 py-3.5 text-[13px] text-bone-soft">
              <span class="font-mono text-[14px] text-status-ready">◍</span>
              <span>
                sleep-time 整合每日 <strong class="text-bone">03:00 UTC</strong>{" "}
                自动运行，修复漂移边与重复陈述，保持图谱一致。
              </span>
            </div>
          </Panel>

          {/* 最近采集 */}
          <Panel
            class="rise p-6"
            variant="panel"
            style="animation-delay: 0.24s"
          >
            <div class="mb-2 flex items-center justify-between">
              <h2 class="font-display text-[19px] font-semibold text-bone">
                最近采集
              </h2>
              <a
                href="/assets"
                class="font-mono text-[11px] uppercase tracking-[0.08em] text-brass no-underline hover:text-brass-bright"
              >
                记忆库全览 →
              </a>
            </div>
            {recentAssets.length > 0 ? (
              <div>
                {recentAssets.map((asset, index) => (
                  <RecentAsset key={asset.id} asset={asset} index={index} />
                ))}
              </div>
            ) : (
              <EmptyState
                class="mt-4"
                title="还没有记忆"
                description="从采集收进第一条内容，或用 MCP 的 remember 写入高密度记忆。"
                action={
                  <a class={buttonClass("primary")} href="/capture">
                    开始采集
                  </a>
                }
              />
            )}
          </Panel>
        </div>

        {/* 右列 */}
        <div class="flex flex-col gap-5">
          {/* 速记 */}
          <Panel
            class="rise p-6"
            variant="panel"
            style="animation-delay: 0.32s"
          >
            <h2 class="mb-3 font-display text-[19px] font-semibold text-bone">
              速记
            </h2>
            <p class="mb-3.5 text-[13px] leading-relaxed text-bone-soft">
              把此刻想留住的东西收进来——原文、链接，或一段 AI 生成的高密度记忆。
            </p>
            <form action="/assets/actions/ingest-text" method="post">
              <Textarea
                name="content"
                rows={4}
                required
                placeholder="记一下：……"
              />
              <div class="mt-3 flex gap-2.5">
                <button
                  type="submit"
                  class={`flex-1 justify-center ${buttonClass("primary")}`}
                >
                  收录这条
                </button>
                <a class={buttonClass("subtle")} href="/capture?mode=url">
                  URL
                </a>
                <a class={buttonClass("subtle")} href="/capture?mode=pdf">
                  PDF
                </a>
              </div>
            </form>
          </Panel>

          {/* 建议问询 */}
          <Panel class="rise p-6" variant="panel" style="animation-delay: 0.4s">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="font-display text-[19px] font-semibold text-bone">
                建议问询
              </h2>
              <a
                href="/ask"
                class="font-mono text-[11px] uppercase tracking-[0.08em] text-brass no-underline hover:text-brass-bright"
              >
                问答 →
              </a>
            </div>
            <div class="flex flex-col gap-2.5">
              {suggestedPrompts.map((prompt) => (
                <a
                  key={prompt}
                  href={`/ask?question=${encodeURIComponent(prompt)}`}
                  class="group relative rounded-md border border-line px-4 py-3 text-[13.5px] text-bone-soft no-underline transition-all duration-150 ease-glass hover:translate-x-0.5 hover:border-brass/40 hover:text-bone"
                >
                  {prompt}
                  <span class="absolute right-4 text-brass opacity-0 transition-opacity group-hover:opacity-100">
                    →
                  </span>
                </a>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
};
