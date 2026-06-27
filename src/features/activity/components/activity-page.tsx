import type { ActivitySnapshot } from "@/features/activity/server/activity-service";
import type { AssetSummary } from "@/features/assets/model/types";
import { PageShell } from "@/features/layout/components/page-shell";
import {
  buttonClass,
  EmptyState,
  Panel,
  StatusBadge,
} from "@/features/ui/components";

const formatDate = (value: string): string =>
  new Date(value).toLocaleString("zh-CN", { hour12: false });

// 资产行：标题 + 元信息 + 状态；failed 时带重试按钮（PRG → reprocess）。
const ActivityRow = ({
  asset,
  retryable,
}: {
  asset: AssetSummary;
  retryable: boolean;
}) => (
  <div class="flex items-start gap-3.5 border-b border-line-soft py-3.5 last:border-none">
    <div class="min-w-0 flex-1">
      <a
        href={`/assets/${asset.id}`}
        class="text-[14.5px] font-semibold leading-snug text-bone no-underline transition-colors hover:text-brass"
      >
        {asset.title}
      </a>
      <div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-bone-faint">
        <span>{asset.type}</span>
        <span>{asset.domain}</span>
        <span>{formatDate(asset.createdAt)}</span>
      </div>
    </div>
    <div class="flex flex-shrink-0 items-center gap-2.5 self-center">
      <StatusBadge status={asset.status} />
      {retryable ? (
        <form action={`/assets/actions/${asset.id}/process`} method="post">
          <button type="submit" class={buttonClass("subtle", "sm")}>
            重试
          </button>
        </form>
      ) : null}
    </div>
  </div>
);

export const ActivityPage = ({ snapshot }: { snapshot: ActivitySnapshot }) => {
  const { failed, inFlight, counts } = snapshot;
  const allQuiet = failed.length === 0 && inFlight.length === 0;

  return (
    <PageShell
      navigationKey="activity"
      eyebrow="系统 · 活动"
      title={
        <>
          活动 / <em class="italic text-brass">任务</em>
        </>
      }
      subtitle="处理中与失败任务的集中视图。失败的可一键重试，处理中的会随流水线推进自动更新。"
    >
      {/* 计量条 */}
      <div class="mb-5 flex flex-wrap gap-x-6 gap-y-1">
        {[
          { label: "失败", value: counts.failed, accent: counts.failed > 0 },
          { label: "处理中", value: counts.processing },
          { label: "待处理", value: counts.pending },
        ].map((item) => (
          <div key={item.label} class="flex items-baseline gap-2">
            <span
              class={`font-display text-[26px] font-medium tabular-nums ${item.accent ? "text-status-failed" : "text-brass"}`}
            >
              {item.value}
            </span>
            <span class="text-[13px] text-bone-soft">{item.label}</span>
          </div>
        ))}
      </div>

      {allQuiet ? (
        <EmptyState
          title="一切就绪"
          description="没有处理中或失败的任务。所有采集的记忆都已处理完毕。"
          action={
            <a class={buttonClass("primary")} href="/capture">
              去采集
            </a>
          }
        />
      ) : (
        <div class="flex flex-col gap-4">
          {/* 需要关注：失败 */}
          {failed.length > 0 ? (
            <Panel class="p-6" variant="panel">
              <div class="mb-3 flex items-center justify-between">
                <h2 class="font-display text-[19px] font-semibold text-bone">
                  需要关注
                </h2>
                <span class="font-mono text-[11px] text-status-failed">
                  {counts.failed} 个失败
                </span>
              </div>
              <p class="mb-3 text-[13px] leading-relaxed text-bone-soft">
                这些资产处理失败。点「重试」会重新跑流水线；具体失败原因可进详情页查看。
              </p>
              <div class="flex flex-col">
                {failed.map((asset) => (
                  <ActivityRow key={asset.id} asset={asset} retryable />
                ))}
              </div>
            </Panel>
          ) : null}

          {/* 处理中 */}
          {inFlight.length > 0 ? (
            <Panel class="p-6" variant="panel">
              <div class="mb-3 flex items-center justify-between">
                <h2 class="font-display text-[19px] font-semibold text-bone">
                  处理中
                </h2>
                <span class="font-mono text-[11px] text-bone-faint">
                  {counts.processing + counts.pending} 个进行中
                </span>
              </div>
              <p class="mb-3 text-[13px] leading-relaxed text-bone-soft">
                这些资产正在流水线里抽取、清洗、摘要、向量化。刷新本页查看最新进度。
              </p>
              <div class="flex flex-col">
                {inFlight.map((asset) => (
                  <ActivityRow key={asset.id} asset={asset} retryable={false} />
                ))}
              </div>
            </Panel>
          ) : null}
        </div>
      )}
    </PageShell>
  );
};
