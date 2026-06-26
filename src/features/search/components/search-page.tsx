import { PageShell } from "@/features/layout/components/page-shell";
import type { EvidenceLayer } from "@/features/search/model/evidence";
import type { SearchResult } from "@/features/search/model/types";
import { buttonClass, EmptyState, Panel } from "@/features/ui/components";

const starterQueries = [
  "Cloudflare 部署决策",
  "我关于向量检索保存了什么？",
  "最近的前端重构笔记",
];

const buildStarterHref = (query: string): string =>
  `/search?query=${encodeURIComponent(query)}`;

const formatDate = (value: string): string =>
  new Date(value).toLocaleString("zh-CN", { hour12: false });

const formatScore = (value: number): string => value.toFixed(3);

const formatLabel = (value: string): string =>
  value
    .split("_")
    .map((segment) =>
      segment.length > 0
        ? `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`
        : segment
    )
    .join(" ");

const getEvidenceLayerLabel = (layer: EvidenceLayer): string =>
  layer === "chunk" ? "切块命中" : "摘要命中";

// 得分 → 三档语义色（强/相关/弱），复用状态色令牌。
const getScoreClasses = (value: number): string => {
  if (value >= 0.85) {
    return "text-status-ready border-status-ready-border bg-status-ready-bg";
  }
  if (value >= 0.65) {
    return "text-status-processing border-status-processing-border bg-status-processing-bg";
  }
  return "text-status-pending border-status-pending-border bg-status-pending-bg";
};

const getScoreLabel = (value: number): string => {
  if (value >= 0.85) return "强匹配";
  if (value >= 0.65) return "相关";
  return "弱匹配";
};

const chipClass =
  "rounded bg-ink-raised px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-bone-soft";

// 搜索：工作台内的语义检索面板，召回切块 → 还原成可查看的资产来源。
export const SearchPage = ({
  result,
  query,
}: {
  result: SearchResult;
  query: string;
}) => {
  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;
  const hasResults = result.groupedEvidence.length > 0;

  return (
    <PageShell
      navigationKey="search"
      eyebrow="系统 · 搜索"
      title={
        <>
          语义<em class="italic text-brass">检索</em>
        </>
      }
      subtitle="在收录的记忆里做语义召回，查看切块级命中，决定下一步打开、对比还是追问。"
      actions={
        <>
          <a class={buttonClass("subtle")} href="/ask">
            ? 问答
          </a>
          <a class={buttonClass("subtle")} href="/capture">
            + 补充来源
          </a>
        </>
      }
    >
      <section class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.82fr)]">
        <div class="flex flex-col gap-4">
          {/* 检索框 */}
          <Panel class="p-6" variant="panel">
            <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-faint">
                  Semantic retrieval
                </p>
                <h2 class="font-display text-[22px] font-semibold text-bone">
                  按含义检索记忆
                </h2>
              </div>
              <div class="rounded-md border border-line bg-ink-raised px-3 py-2 font-mono text-[11px] text-bone-soft">
                {result.pagination.total} 条排序资产
              </div>
            </div>

            <form method="get" action="/search" class="grid gap-3">
              <label class="grid gap-1.5">
                <span class="text-[13px] font-medium text-bone-soft">
                  语义查询
                </span>
                <input
                  name="query"
                  type="search"
                  defaultValue={query}
                  placeholder="按含义检索笔记、PDF 与保存的 URL"
                  class="w-full rounded-md border border-line bg-ink-raised px-4 py-2 text-[15px] text-bone outline-none transition-colors placeholder:text-bone-faint focus:border-brass"
                />
              </label>
              <div class="flex flex-wrap items-center gap-3">
                <button type="submit" class={buttonClass("primary")}>
                  搜索
                </button>
                <span class={chipClass}>资产级重排 + 分组证据</span>
              </div>
            </form>

            {!hasQuery ? (
              <div class="mt-4 flex flex-wrap gap-2">
                {starterQueries.map((item) => (
                  <a
                    key={item}
                    href={buildStarterHref(item)}
                    class="rounded-md border border-line bg-ink-raised px-3 py-2 text-[13px] text-bone-soft no-underline transition-colors hover:border-brass/40 hover:text-bone"
                  >
                    {item}
                  </a>
                ))}
              </div>
            ) : null}
          </Panel>

          {/* 检索输出 */}
          <Panel class="p-6" variant="panel">
            <div class="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <h2 class="font-display text-[22px] font-semibold text-bone">
                检索结果
              </h2>
              <span class="font-mono text-[12px] text-bone-faint">
                第 {result.pagination.page} /{" "}
                {Math.max(result.pagination.totalPages, 1)} 页
              </span>
            </div>

            {!hasQuery ? (
              <EmptyState
                title="输入一个主题或问题"
                description="搜索会先召回最相关的切块，再把它们还原成可查看的资产来源。"
              />
            ) : !hasResults ? (
              <EmptyState
                title="没有找到匹配结果"
                description="换一种表达，或先去采集补充上下文资产再回来搜索。"
                action={
                  <a class={buttonClass("primary")} href="/capture">
                    去采集
                  </a>
                }
              />
            ) : (
              <div class="flex flex-col gap-3">
                {result.groupedEvidence.map((group, index) => {
                  const asset = group.asset;
                  const primaryEvidence = group.primaryEvidence;
                  const scoreClasses = getScoreClasses(group.assetScore);
                  const scoreLabel = getScoreLabel(group.assetScore);
                  const indexingTags = [asset.domain, asset.sourceHost].filter(
                    (value): value is string => Boolean(value?.trim())
                  );

                  return (
                    <Panel key={asset.id} class="p-4" variant="raised">
                      <div class="mb-2 flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div class="mb-2 flex flex-wrap gap-1.5">
                            <span class={chipClass}>{asset.type}</span>
                            <span
                              class={`rounded border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] ${scoreClasses}`}
                            >
                              {scoreLabel}
                            </span>
                            <span class={chipClass}>
                              {group.items.length} 证据
                            </span>
                            {group.matchedLayers.map((layer) => (
                              <span
                                key={`${asset.id}:layer:${layer}`}
                                class={chipClass}
                              >
                                {getEvidenceLayerLabel(layer)}
                              </span>
                            ))}
                            {indexingTags.map((tag) => (
                              <span
                                key={`${asset.id}:group:${tag}`}
                                class={chipClass}
                              >
                                {formatLabel(tag)}
                              </span>
                            ))}
                          </div>
                          <a
                            href={`/assets/${asset.id}`}
                            class="text-[18px] font-semibold text-bone no-underline hover:text-brass"
                          >
                            {asset.title}
                          </a>
                        </div>

                        <div class="grid min-w-[130px] justify-items-end gap-0.5">
                          <span class="font-display text-[18px] font-medium tabular-nums text-brass">
                            {formatScore(group.assetScore)}
                          </span>
                          <span class="font-mono text-[11px] text-bone-faint">
                            排名 #{index + 1}
                          </span>
                          <span class="font-mono text-[11px] text-bone-faint">
                            顶证据 {formatScore(group.topScore)}
                          </span>
                        </div>
                      </div>

                      <div class="mb-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-bone-faint">
                        <span>
                          主证据：{getEvidenceLayerLabel(primaryEvidence.layer)}
                        </span>
                        <span>{formatDate(asset.createdAt)}</span>
                        <span class="truncate">
                          {asset.sourceUrl ?? `ID: ${asset.id}`}
                        </span>
                      </div>

                      <p class="mb-3 text-[14.5px] leading-[1.8] text-bone-soft">
                        {asset.summary ?? primaryEvidence.snippet}
                      </p>

                      <div class="mb-3 rounded-md border border-line bg-ink-panel p-3">
                        <p class="mb-2 text-[13px] font-semibold text-brass">
                          {group.groupSummary.headline}
                        </p>
                        <div class="grid gap-1">
                          {group.groupSummary.bullets.map((bullet) => (
                            <p
                              key={`${asset.id}:summary:${bullet}`}
                              class="text-[13px] leading-relaxed text-bone-soft"
                            >
                              {bullet}
                            </p>
                          ))}
                        </div>
                      </div>

                      <div class="mb-3 grid gap-2">
                        {group.items.slice(0, 3).map((evidence) => (
                          <div
                            key={evidence.id}
                            class="rounded-md border border-line bg-ink-panel p-3"
                          >
                            <div class="mb-2 flex flex-wrap items-center justify-between gap-3">
                              <div class="flex flex-wrap items-center gap-2">
                                <span class={chipClass}>
                                  {getEvidenceLayerLabel(evidence.layer)}
                                </span>
                                {evidence.layer === "chunk" ? (
                                  <span class="font-mono text-[11px] text-bone-faint">
                                    #{evidence.chunkIndex ?? 0}
                                  </span>
                                ) : null}
                              </div>
                              <span class="font-mono text-[12px] font-medium text-bone">
                                {formatScore(evidence.score)}
                              </span>
                            </div>
                            <p class="text-[13.5px] leading-[1.7] text-bone-soft">
                              {evidence.snippet}
                            </p>
                            {evidence.matchReasons.length > 0 ? (
                              <div class="mt-2 flex flex-wrap gap-1.5">
                                {evidence.matchReasons.map((reason) => (
                                  <span
                                    key={`${evidence.id}:reason:${reason.code}`}
                                    title={reason.detail}
                                    class={chipClass}
                                  >
                                    {reason.label}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      <div class="flex flex-wrap gap-2.5">
                        <a
                          class={buttonClass("primary", "sm")}
                          href={`/assets/${asset.id}`}
                        >
                          打开资产
                        </a>
                        <a
                          class={buttonClass("subtle", "sm")}
                          href={`/ask?question=${encodeURIComponent(
                            `基于《${asset.title}》，${trimmedQuery}`
                          )}`}
                        >
                          基于此追问
                        </a>
                      </div>
                    </Panel>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* 右栏：遥测 + 指南 */}
        <aside class="flex flex-col gap-4">
          <Panel class="p-5" variant="panel">
            <p class="mb-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-faint">
              Search telemetry
            </p>
            <div class="grid gap-2">
              {[
                { label: "查询状态", value: hasQuery ? "活跃" : "空闲" },
                { label: "总匹配", value: String(result.pagination.total) },
                {
                  label: "每页资产",
                  value: String(result.pagination.pageSize),
                },
                { label: "本页证据", value: String(result.items.length) },
                { label: "当前页", value: String(result.pagination.page) },
              ].map((item, index) => (
                <div
                  key={item.label}
                  class={`flex items-center justify-between gap-3 text-[13px] text-bone-soft ${index === 0 ? "" : "border-t border-line-soft pt-2"}`}
                >
                  <span>{item.label}</span>
                  <span class="font-mono font-medium text-bone">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel class="p-5" variant="panel">
            <p class="mb-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-brass">
              检索提示
            </p>
            <div class="grid gap-3">
              {[
                "搜索作用在切块而非整篇文档，所以问概念而非仅标题。",
                "分层索引标签展示采集时抽取的领域与来源主机。",
                "正文不对 AI 可见时，仅摘要资产会以抽象命中形式出现。",
                "结果接近但不完整时，跳到问答把它变成带来源的追问。",
                "弱或空结果通常意味库里处理过的上下文不够，未必是检索错。",
              ].map((tip, index) => (
                <div
                  key={tip}
                  class="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-3"
                >
                  <span class="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-line bg-ink-raised font-mono text-[12px] font-medium text-brass">
                    {index + 1}
                  </span>
                  <p class="text-[13px] leading-[1.7] text-bone-soft">{tip}</p>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </section>
    </PageShell>
  );
};
