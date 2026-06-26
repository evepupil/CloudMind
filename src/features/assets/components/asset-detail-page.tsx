import type { AssetDetail, AssetType } from "@/features/assets/model/types";
import { PageShell } from "@/features/layout/components/page-shell";
import {
  buttonClass,
  FlashMessage,
  Panel,
  StatusBadge,
} from "@/features/ui/components";

import { AssetPageActions } from "./asset-page-actions";
import { AssetTabs } from "./asset-tabs";

const reprocessableAssetTypes: AssetType[] = ["note", "chat", "url", "pdf"];

const formatDate = (value: string | null): string => {
  if (!value) {
    return "N/A";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
};

const formatLabel = (value: string): string =>
  value
    .split("_")
    .map((segment) =>
      segment.length > 0
        ? `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`
        : segment
    )
    .join(" ");

const canReprocessAsset = (type: AssetType): boolean =>
  reprocessableAssetTypes.includes(type);

// 右栏小标题
const PanelTitle = ({ children }: { children: string }) => (
  <h2 class="mb-3 font-display text-[17px] font-semibold text-bone">
    {children}
  </h2>
);

// 区块大标题
const SectionTitle = ({ children }: { children: string }) => (
  <h2 class="mb-3 font-display text-[20px] font-semibold text-bone">
    {children}
  </h2>
);

const manageInputClass =
  "w-full rounded-md border border-line bg-ink-raised px-3 py-2 text-[14px] text-bone outline-none transition-colors focus:border-brass";

// 资产详情：阅读优先（左正文）+ 右栏 Inspector（管理/来源/处理/任务）。
export const AssetDetailPage = ({
  item,
  errorMessage,
  flashMessage,
}: {
  item?: AssetDetail | undefined;
  errorMessage?: string | undefined;
  flashMessage?: string | undefined;
}) => {
  if (!item) {
    return (
      <PageShell
        navigationKey="library"
        eyebrow="工作区 · 记忆库"
        title="资产详情"
        subtitle="查看单条记忆的来源、处理结果与任务历史。"
        actions={<AssetPageActions />}
      >
        <FlashMessage kind="error">
          {errorMessage ?? "未找到该资产。"}
        </FlashMessage>
      </PageShell>
    );
  }

  const isReprocessable = canReprocessAsset(item.type);
  const tags = [
    item.domain,
    item.aiVisibility,
    item.sourceKind,
    item.sourceHost,
  ].filter((value): value is string => Boolean(value?.trim()));

  return (
    <PageShell
      navigationKey="library"
      eyebrow="工作区 · 记忆库 / 详情"
      title={item.title}
      subtitle="阅读清洗后的正文、查看来源记录并管理这条记忆。运行级执行细节见「工作流检视」。"
      actions={<AssetPageActions assetId={item.id} />}
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

      <AssetTabs assetId={item.id} activeTab="detail" />

      <section class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.75fr)]">
        {/* 左：正文阅读区 */}
        <div class="flex flex-col gap-4">
          <Panel class="p-6" variant="panel">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div class="font-mono text-[11px] text-bone-faint">
                {item.type} · 创建于 {formatDate(item.createdAt)}
              </div>
              <StatusBadge status={item.status} />
            </div>
            <SectionTitle>摘要</SectionTitle>
            <p class="text-[15px] leading-[1.85] text-bone-soft">
              {item.summary ?? "摘要尚未生成。"}
            </p>
            {tags.length > 0 ? (
              <div class="mt-4 flex flex-wrap gap-1.5">
                {tags.map((value) => (
                  <span
                    key={value}
                    class="rounded bg-ink-raised px-2 py-0.5 font-mono text-[11px] text-bone-soft"
                  >
                    {formatLabel(value)}
                  </span>
                ))}
              </div>
            ) : null}
          </Panel>

          <Panel class="p-6" variant="panel">
            <SectionTitle>分层索引</SectionTitle>
            <div class="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
              {[
                { label: "领域", value: item.domain },
                { label: "来源主机", value: item.sourceHost ?? "N/A" },
                { label: "集合", value: item.collectionKey ?? "N/A" },
                { label: "AI 可见性", value: item.aiVisibility },
              ].map((entry) => (
                <div
                  key={entry.label}
                  class="rounded-md border border-line bg-ink-raised px-4 py-3"
                >
                  <div class="font-mono text-[10.5px] uppercase tracking-[0.1em] text-bone-faint">
                    {entry.label}
                  </div>
                  <div class="mt-1.5 break-words text-[14px] font-medium text-bone">
                    {entry.value}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel class="p-6" variant="panel">
            <SectionTitle>正文</SectionTitle>
            <pre class="m-0 whitespace-pre-wrap break-words font-mono text-[13px] leading-[1.8] text-bone-soft">
              {item.contentText ?? "正文尚未存储。"}
            </pre>
          </Panel>

          <Panel class="p-6" variant="panel">
            <SectionTitle>切块</SectionTitle>
            {item.chunks.length === 0 ? (
              <p class="text-[14px] text-bone-soft">暂无切块记录。</p>
            ) : (
              <div class="flex flex-col gap-3">
                {item.chunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    class="rounded-md border border-line bg-ink-raised p-4"
                  >
                    <div class="mb-2 flex justify-between gap-3 font-mono text-[12px] text-bone">
                      <span>切块 #{chunk.chunkIndex}</span>
                      <span class="text-bone-faint">
                        {chunk.vectorId ?? "无向量"}
                      </span>
                    </div>
                    <p class="text-[13px] leading-[1.7] text-bone-soft">
                      {chunk.textPreview}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* 右：Inspector 副栏 */}
        <aside class="flex flex-col gap-4">
          <Panel class="p-5" variant="panel">
            <PanelTitle>管理</PanelTitle>
            <form
              action={`/assets/actions/${item.id}/update`}
              method="post"
              class="grid gap-3"
            >
              <label class="grid gap-1.5">
                <span class="text-[12px] font-medium text-bone-soft">标题</span>
                <input
                  name="title"
                  defaultValue={item.title}
                  required
                  class={manageInputClass}
                />
              </label>
              <label class="grid gap-1.5">
                <span class="text-[12px] font-medium text-bone-soft">
                  来源 URL
                </span>
                <input
                  name="sourceUrl"
                  type="url"
                  defaultValue={item.sourceUrl ?? ""}
                  placeholder="https://example.com"
                  class={manageInputClass}
                />
              </label>
              <label class="grid gap-1.5">
                <span class="text-[12px] font-medium text-bone-soft">摘要</span>
                <textarea
                  name="summary"
                  defaultValue={item.summary ?? ""}
                  rows={5}
                  class={`${manageInputClass} resize-y leading-[1.7]`}
                />
              </label>
              <button type="submit" class={buttonClass("primary")}>
                保存修改
              </button>
            </form>
            <form
              action={`/assets/actions/${item.id}/delete`}
              method="post"
              class="mt-3"
            >
              <button type="submit" class={`w-full ${buttonClass("danger")}`}>
                删除资产
              </button>
            </form>
            <p class="mt-2.5 text-[12px] leading-[1.6] text-bone-faint">
              当前为软删除：资产从列表、搜索与问答结果中消失，可恢复。
            </p>
          </Panel>

          <Panel class="p-5" variant="panel">
            <PanelTitle>来源</PanelTitle>
            <dl class="grid gap-3">
              <div>
                <dt class="font-mono text-[11px] uppercase tracking-[0.08em] text-bone-faint">
                  类型
                </dt>
                <dd class="mt-1 text-[14px] text-bone">
                  {item.source?.kind ?? "暂无来源记录。"}
                </dd>
              </div>
              <div>
                <dt class="font-mono text-[11px] uppercase tracking-[0.08em] text-bone-faint">
                  URL
                </dt>
                <dd class="mt-1 break-words text-[14px] text-bone">
                  {item.source?.sourceUrl ?? item.sourceUrl ?? "N/A"}
                </dd>
              </div>
              <div>
                <dt class="font-mono text-[11px] uppercase tracking-[0.08em] text-bone-faint">
                  原始 R2 Key
                </dt>
                <dd class="mt-1 break-words font-mono text-[12px] text-bone-soft">
                  {item.rawR2Key ?? "N/A"}
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel class="p-5" variant="panel">
            <PanelTitle>处理</PanelTitle>
            <div class="grid gap-2 text-[13px] text-bone-soft">
              <div>更新：{formatDate(item.updatedAt)}</div>
              <div>处理完成：{formatDate(item.processedAt)}</div>
              <div>MIME：{item.mimeType ?? "N/A"}</div>
              <div>语言：{item.language ?? "N/A"}</div>
              {isReprocessable ? (
                <form
                  action={`/assets/actions/${item.id}/process`}
                  method="post"
                  class="mt-1"
                >
                  <button type="submit" class={buttonClass("subtle")}>
                    重新处理
                  </button>
                </form>
              ) : null}
            </div>
          </Panel>

          <Panel class="p-5" variant="panel">
            <PanelTitle>任务</PanelTitle>
            {item.jobs.length === 0 ? (
              <p class="text-[14px] text-bone-soft">暂无任务记录。</p>
            ) : (
              <div class="flex flex-col gap-3">
                {item.jobs.map((job) => (
                  <div
                    key={job.id}
                    class="rounded-md border border-line bg-ink-raised px-4 py-3"
                  >
                    <div class="flex justify-between gap-3 font-mono text-[12px] text-bone">
                      <span>{job.jobType}</span>
                      <span class="text-bone-soft">{job.status}</span>
                    </div>
                    <div class="mt-1.5 font-mono text-[11px] text-bone-faint">
                      第 {job.attempt} 次 · {formatDate(job.createdAt)}
                    </div>
                    {job.errorMessage ? (
                      <p class="mt-1.5 text-[12px] text-status-failed">
                        {job.errorMessage}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </aside>
      </section>
    </PageShell>
  );
};
