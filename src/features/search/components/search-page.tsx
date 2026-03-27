import { PageShell } from "@/features/layout/components/page-shell";
import type { EvidenceLayer } from "@/features/search/model/evidence";
import type { SearchResult } from "@/features/search/model/types";

const starterQueries = [
  "Cloudflare deployment decisions",
  "What did I save about vector search?",
  "Recent notes about frontend refactor",
];

const buildStarterHref = (query: string): string => {
  return `/search?query=${encodeURIComponent(query)}`;
};

const formatDate = (value: string): string => {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
};

const formatScore = (value: number): string => {
  return value.toFixed(3);
};

const formatLabel = (value: string): string => {
  return value
    .split("_")
    .map((segment) =>
      segment.length > 0
        ? `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`
        : segment
    )
    .join(" ");
};

const getEvidenceLayerLabel = (layer: EvidenceLayer): string => {
  if (layer === "chunk") {
    return "Chunk match";
  }

  if (layer === "assertion") {
    return "Assertion match";
  }

  if (layer === "term") {
    return "Metadata term match";
  }

  return "Summary match";
};

const getScoreClasses = (value: number): string => {
  if (value >= 0.85) {
    return "text-[#2e6c3e] bg-[#e3f2e8] border-[#b7dbbf]";
  }

  if (value >= 0.65) {
    return "text-[#2e6a9c] bg-[#e3eef9] border-[#b7d4e8]";
  }

  return "text-[#7c6a2e] bg-[#f9f3e3] border-[#e8dbb7]";
};

const getScoreLabel = (value: number): string => {
  if (value >= 0.85) {
    return "Strong match";
  }

  if (value >= 0.65) {
    return "Relevant";
  }

  return "Weak match";
};

// 这里把 Search 改成工作台内的检索面板，不再作为脱离壳层的单页。
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
      title="Search your library"
      subtitle="Run semantic retrieval across saved assets, inspect chunk-level matches, and decide what should be opened, compared, or asked next."
      navigationKey="search"
      actions={
        <>
          <a
            href="/ask"
            class="rounded-md border border-[#e8e8e7] bg-white px-4 py-2 text-[#37352f] font-bold no-underline"
          >
            Open Ask
          </a>
          <a
            href="/capture"
            class="rounded-md border border-[#e8e8e7] bg-[#fafaf9] px-4 py-2 text-[#37352f] font-bold no-underline"
          >
            Add sources
          </a>
        </>
      }
    >
      <section class="grid grid-cols-[minmax(0,1.55fr)_minmax(300px,0.82fr)] gap-[18px]">
        <div class="grid gap-4">
          <article class="rounded-lg border border-[#e8e8e7] bg-white p-6">
            <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="mb-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#9b9a97]">
                  Semantic retrieval
                </p>
                <h2 class="m-0 text-[28px] font-extrabold tracking-tight text-[#37352f]">
                  Query the knowledge graph-in-progress
                </h2>
              </div>
              <div class="rounded-md border border-[#ededec] bg-[#fafaf9] px-3 py-2 text-[13px] text-[#787774]">
                {result.pagination.total} ranked assets
              </div>
            </div>

            <form method="get" action="/search" class="grid gap-3">
              <label class="grid gap-2">
                <span class="text-[14px] font-bold text-[#37352f]">
                  Semantic query
                </span>
                <input
                  name="query"
                  type="search"
                  defaultValue={query}
                  placeholder="Search across notes, PDFs, and saved URLs by meaning"
                  class="w-full rounded-md border border-[#e8e8e7] bg-white px-4 py-2 text-[15px] text-[#37352f] focus:outline-none focus:border-[#2383e2]"
                />
              </label>

              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    class="rounded-md bg-[#37352f] px-4 py-2 text-[14px] font-bold text-white cursor-pointer border-none hover:bg-[#2f2d28] transition-colors"
                  >
                    Search library
                  </button>
                  <span class="px-2 py-0.5 text-[12px] bg-[#f1f1f0] text-[#787774] rounded">
                    Asset-level rerank + grouped evidence
                  </span>
                </div>
                <span class="text-[13px] text-[#9b9a97]">
                  Page refresh for now. Async search can come next.
                </span>
              </div>
            </form>

            {!hasQuery ? (
              <div class="mt-4 flex flex-wrap gap-2">
                {starterQueries.map((item) => (
                  <a
                    key={item}
                    href={buildStarterHref(item)}
                    class="rounded-md border border-[#ededec] bg-[#fafaf9] px-3 py-2 text-[13px] text-[#787774] no-underline"
                  >
                    {item}
                  </a>
                ))}
              </div>
            ) : null}
          </article>

          <section class="rounded-lg border border-[#e8e8e7] bg-white p-6">
            <div class="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p class="mb-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#9b9a97]">
                  Results
                </p>
                <h2 class="m-0 text-[28px] font-extrabold tracking-tight text-[#37352f]">
                  Retrieval output
                </h2>
              </div>
              <span class="text-[13px] text-[#787774]">
                Page {result.pagination.page} /{" "}
                {Math.max(result.pagination.totalPages, 1)}
              </span>
            </div>

            {!hasQuery ? (
              <article class="rounded-md border border-dashed border-[#e8e8e7] bg-white p-4 text-[#787774] leading-relaxed">
                输入一个主题、问题或技术决策方向，Search 会先召回最相关的
                chunk，再把它们还原成可查看的资产来源。
              </article>
            ) : !hasResults ? (
              <article class="rounded-md border border-dashed border-[#e8e8e7] bg-white p-4 text-[#787774] leading-relaxed">
                没有找到匹配结果。可以换一种表达方式，或者先去 Capture
                增加上下文资产再回来搜索。
              </article>
            ) : (
              <div class="grid gap-3">
                {result.groupedEvidence.map((group, index) => {
                  const asset = group.asset;
                  const primaryEvidence = group.primaryEvidence;
                  const scoreClasses = getScoreClasses(group.assetScore);
                  const scoreLabel = getScoreLabel(group.assetScore);
                  const indexingTags = [
                    asset.domain,
                    asset.documentClass,
                    asset.sourceHost,
                    ...primaryEvidence.indexing.topics,
                  ].filter((value): value is string => Boolean(value?.trim()));

                  return (
                    <article
                      key={asset.id}
                      class="rounded-lg border border-[#e8e8e7] bg-white p-4 pb-5"
                    >
                      <div class="mb-2 flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div class="mb-2 flex flex-wrap gap-2">
                            <span class="px-2 py-0.5 text-[12px] bg-[#f1f1f0] text-[#787774] rounded font-bold uppercase tracking-wide">
                              {asset.type}
                            </span>
                            <span
                              class={`px-2 py-0.5 text-[12px] rounded border font-bold uppercase tracking-wide ${scoreClasses}`}
                            >
                              {scoreLabel}
                            </span>
                            <span class="px-2 py-0.5 text-[12px] bg-[#e3eef9] text-[#2e6a9c] border border-[#b7d4e8] rounded font-bold uppercase tracking-wide">
                              {group.items.length} evidence
                            </span>
                          </div>
                          <div
                            class={`mb-2 flex flex-wrap gap-2 ${indexingTags.length > 0 ? "mb-2" : "mb-2"}`}
                          >
                            {group.matchedLayers.map((layer) => (
                              <span
                                key={`${asset.id}:layer:${layer}`}
                                class="px-2 py-0.5 text-[12px] bg-[#f3eefa] text-[#7a3fb2] border border-[#e0d4ee] rounded font-bold uppercase tracking-wide"
                              >
                                {getEvidenceLayerLabel(layer)}
                              </span>
                            ))}
                          </div>
                          {indexingTags.length > 0 ? (
                            <div class="mb-2 flex flex-wrap gap-2">
                              {indexingTags.map((tag) => (
                                <span
                                  key={`${asset.id}:group:${tag}`}
                                  class="px-2 py-0.5 text-[12px] bg-[#f1f1f0] text-[#787774] rounded font-bold"
                                >
                                  {formatLabel(tag)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <a
                            href={`/assets/${asset.id}`}
                            class="text-[20px] font-extrabold text-[#37352f] no-underline"
                          >
                            {asset.title}
                          </a>
                        </div>

                        <div class="grid min-w-[142px] gap-1 justify-items-end">
                          <span class="text-[16px] font-extrabold text-[#37352f]">
                            {formatScore(group.assetScore)}
                          </span>
                          <span class="text-[12px] text-[#787774]">
                            Asset rank #{index + 1}
                          </span>
                          <span class="text-[12px] text-[#787774]">
                            {`Top evidence ${formatScore(group.topScore)}`}
                          </span>
                        </div>
                      </div>

                      <div class="mb-2 flex flex-wrap gap-2 text-[13px] text-[#787774]">
                        <span>{`Primary: ${getEvidenceLayerLabel(primaryEvidence.layer)}`}</span>
                        <span>
                          {`Visibility: ${formatLabel(primaryEvidence.indexing.aiVisibility)}`}
                        </span>
                        {primaryEvidence.indexing.collectionKey ? (
                          <span>{`Collection: ${primaryEvidence.indexing.collectionKey}`}</span>
                        ) : null}
                        <span>{formatDate(asset.createdAt)}</span>
                        <span>
                          {asset.sourceUrl ?? `Asset ID: ${asset.id}`}
                        </span>
                      </div>

                      <p class="mb-3 text-[15px] leading-[1.82] text-[#37352f]">
                        {asset.summary ?? primaryEvidence.snippet}
                      </p>

                      <article class="mb-4 rounded-md border border-[#ededec] bg-[#fafaf9] p-3">
                        <p class="mb-2 text-[13px] font-extrabold text-[#2383e2]">
                          {group.groupSummary.headline}
                        </p>
                        <div class="grid gap-1">
                          {group.groupSummary.bullets.map((bullet) => (
                            <p
                              key={`${asset.id}:summary:${bullet}`}
                              class="m-0 text-[13px] leading-relaxed text-[#37352f]"
                            >
                              {bullet}
                            </p>
                          ))}
                        </div>
                      </article>

                      <div class="mb-4 grid gap-2">
                        {group.items.slice(0, 3).map((evidence) => (
                          <article
                            key={evidence.id}
                            class="rounded-md border border-[#ededec] bg-[#fafaf9] p-3"
                          >
                            <div class="mb-2 flex flex-wrap items-center justify-between gap-3">
                              <div class="flex flex-wrap gap-2">
                                <span class="px-2 py-0.5 text-[12px] bg-white text-[#787774] rounded border border-[#ededec] font-bold">
                                  {getEvidenceLayerLabel(evidence.layer)}
                                </span>
                                {evidence.layer === "chunk" ? (
                                  <span class="text-[12px] text-[#787774]">
                                    {`Chunk #${evidence.chunkIndex ?? 0}`}
                                  </span>
                                ) : evidence.layer === "assertion" ? (
                                  <span class="text-[12px] text-[#787774]">
                                    {`Assertion #${evidence.assertionIndex ?? 0}`}
                                  </span>
                                ) : evidence.layer === "term" ? (
                                  <span class="text-[12px] text-[#787774]">
                                    Metadata-backed asset recall
                                  </span>
                                ) : (
                                  <span class="text-[12px] text-[#787774]">
                                    Summary-only evidence
                                  </span>
                                )}
                              </div>
                              <span class="text-[12px] font-bold text-[#37352f]">
                                {formatScore(evidence.score)}
                              </span>
                            </div>
                            <p class="m-0 text-[14px] leading-[1.7] text-[#37352f]">
                              {evidence.snippet}
                            </p>
                            {evidence.layer === "term" &&
                            evidence.matchedTerms &&
                            evidence.matchedTerms.length > 0 ? (
                              <div class="mt-2 flex flex-wrap gap-2">
                                {evidence.matchedTerms.map((term) => (
                                  <span
                                    key={`${evidence.id}:term:${term.facetKey}:${term.facetValue}`}
                                    class="px-2 py-0.5 text-[12px] bg-white text-[#787774] rounded border border-[#ededec] font-bold"
                                  >
                                    {`${term.facetKey}: ${term.facetValue}`}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <div class="mt-2 flex flex-wrap gap-2">
                              {evidence.matchReasons.map((reason) => (
                                <span
                                  key={`${evidence.id}:reason:${reason.code}`}
                                  title={reason.detail}
                                  class="px-2 py-0.5 text-[12px] bg-white text-[#787774] rounded border border-[#ededec] font-bold"
                                >
                                  {reason.label}
                                </span>
                              ))}
                            </div>
                          </article>
                        ))}
                      </div>

                      <div class="flex flex-wrap gap-2">
                        <a
                          href={`/assets/${asset.id}`}
                          class="rounded-md bg-[#37352f] px-4 py-2 text-[13px] font-bold text-white no-underline hover:bg-[#2f2d28] transition-colors"
                        >
                          Open asset
                        </a>
                        <a
                          href={`/ask?question=${encodeURIComponent(
                            `Based on ${asset.title}, ${trimmedQuery}`
                          )}`}
                          class="rounded-md border border-[#e8e8e7] bg-[#fafaf9] px-4 py-2 text-[13px] font-bold text-[#37352f] no-underline hover:bg-[#f1f1f0] transition-colors"
                        >
                          Ask from result
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside class="grid gap-4">
          <article class="rounded-lg border border-[#e8e8e7] bg-white p-5">
            <p class="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#9b9a97]">
              Search telemetry
            </p>
            <div class="grid gap-2">
              {[
                {
                  label: "Query state",
                  value: hasQuery ? "Active" : "Idle",
                },
                {
                  label: "Total matches",
                  value: String(result.pagination.total),
                },
                {
                  label: "Assets / page",
                  value: String(result.pagination.pageSize),
                },
                {
                  label: "Evidence on page",
                  value: String(result.items.length),
                },
                {
                  label: "Current page",
                  value: String(result.pagination.page),
                },
              ].map((item, index) => (
                <div
                  key={item.label}
                  class={`flex items-center justify-between gap-3 text-[13px] text-[#787774] ${index === 0 ? "" : "border-t border-[#ededec] pt-2"}`}
                >
                  <span>{item.label}</span>
                  <span class="font-bold text-[#37352f]">{item.value}</span>
                </div>
              ))}
            </div>
          </article>

          <article class="rounded-lg border border-[#e8e8e7] bg-white p-5">
            <p class="mb-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#2383e2]">
              Search guide
            </p>
            <div class="grid gap-3">
              {[
                "Search works on chunks, not whole documents, so ask about concepts rather than titles only.",
                "Layered index chips show domain, document class, assertion kind, and topics extracted during ingest.",
                "Summary-only assets can appear as abstracted matches when the raw body is not AI-visible.",
                "If a result looks close but incomplete, jump into Ask and turn that query into a source-aware follow-up.",
                "Weak or empty results usually mean the library lacks enough processed context, not necessarily that retrieval is wrong.",
              ].map((tip, index) => (
                <div
                  key={tip}
                  class="grid grid-cols-[26px_minmax(0,1fr)] gap-3 items-start"
                >
                  <span class="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-[#b7d4e8] bg-[#e3eef9] text-[12px] font-extrabold text-[#2e6a9c]">
                    {index + 1}
                  </span>
                  <p class="m-0 mt-0 leading-[1.75] text-[#37352f]">{tip}</p>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </PageShell>
  );
};
