import type { AssetDetail, AssetType } from "@/features/assets/model/types";
import { PageShell } from "@/features/layout/components/page-shell";

import { AssetPageActions } from "./asset-page-actions";
import { AssetStatusBadge } from "./asset-status-badge";
import { AssetTabs } from "./asset-tabs";

const reprocessableAssetTypes: AssetType[] = ["note", "chat", "url", "pdf"];

const formatDate = (value: string | null): string => {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
};

interface AssetDescriptorView {
  assetType?: string | null | undefined;
  sourceKind?: string | null | undefined;
  domain?: string | null | undefined;
  documentClass?: string | null | undefined;
  topics?: string[] | undefined;
  collectionKey?: string | null | undefined;
  capturedAt?: string | null | undefined;
  sourceHost?: string | null | undefined;
  language?: string | null | undefined;
  mimeType?: string | null | undefined;
  signals?: string[] | undefined;
}

const parseDescriptorJson = (
  descriptorJson: string | null
): AssetDescriptorView | null => {
  if (!descriptorJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(descriptorJson);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      assetType: typeof parsed.assetType === "string" ? parsed.assetType : null,
      sourceKind:
        typeof parsed.sourceKind === "string" ? parsed.sourceKind : null,
      domain: typeof parsed.domain === "string" ? parsed.domain : null,
      documentClass:
        typeof parsed.documentClass === "string" ? parsed.documentClass : null,
      topics: Array.isArray(parsed.topics)
        ? parsed.topics.filter(
            (topic: unknown): topic is string => typeof topic === "string"
          )
        : [],
      collectionKey:
        typeof parsed.collectionKey === "string" ? parsed.collectionKey : null,
      capturedAt:
        typeof parsed.capturedAt === "string" ? parsed.capturedAt : null,
      sourceHost:
        typeof parsed.sourceHost === "string" ? parsed.sourceHost : null,
      language: typeof parsed.language === "string" ? parsed.language : null,
      mimeType: typeof parsed.mimeType === "string" ? parsed.mimeType : null,
      signals: Array.isArray(parsed.signals)
        ? parsed.signals.filter(
            (signal: unknown): signal is string => typeof signal === "string"
          )
        : [],
    };
  } catch {
    return null;
  }
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

const canReprocessAsset = (type: AssetType): boolean => {
  return reprocessableAssetTypes.includes(type);
};

const MessageBanner = ({
  children,
  tone,
}: {
  children: string;
  tone: "success" | "error";
}) => {
  const toneClasses =
    tone === "success"
      ? "bg-[#e3f2e8] text-[#2e6c3e] border-[#b7dbbf]"
      : "bg-[#f9e3e3] text-[#9c2e2e] border-[#e8b7b7]";

  return (
    <section class={`mb-[18px] px-4 py-3 rounded-md border ${toneClasses}`}>
      {children}
    </section>
  );
};

// 这里重做详情页原型，让它更像知识档案页而不是字段回显页。
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
        title="Asset detail"
        subtitle="Review source, processed content, and job history for a single knowledge asset."
        navigationKey="library"
        actions={<AssetPageActions />}
      >
        <MessageBanner tone="error">
          {errorMessage ?? "Asset not found."}
        </MessageBanner>
      </PageShell>
    );
  }

  const isReprocessable = canReprocessAsset(item.type);
  const descriptor = parseDescriptorJson(item.descriptorJson);

  return (
    <PageShell
      title={item.title}
      subtitle="Read cleaned content, inspect the source record, and manage the asset here. Open Workflow Inspection for run-by-run execution details."
      navigationKey="library"
      actions={<AssetPageActions assetId={item.id} />}
    >
      {flashMessage ? (
        <MessageBanner tone="success">{flashMessage}</MessageBanner>
      ) : null}

      {errorMessage ? (
        <MessageBanner tone="error">{errorMessage}</MessageBanner>
      ) : null}

      <AssetTabs assetId={item.id} activeTab="detail" />

      <section class="grid grid-cols-[minmax(0,1.15fr)_minmax(280px,0.75fr)] gap-[18px]">
        <div class="grid gap-[18px]">
          <article class="rounded-lg border border-[#e8e8e7] bg-white p-6">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div class="text-[#787774]">
                {item.type} • Created {formatDate(item.createdAt)}
              </div>
              <AssetStatusBadge status={item.status} />
            </div>
            <h2 class="mt-0 text-[22px]">Summary</h2>
            <p class="mb-0 text-[#787774] leading-[1.85]">
              {item.summary ?? "Summary has not been generated yet."}
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
              {[
                item.domain,
                item.documentClass ?? null,
                item.aiVisibility,
                item.sourceKind,
                item.sourceHost,
              ]
                .filter((value): value is string => Boolean(value?.trim()))
                .map((value) => (
                  <span
                    key={value}
                    class="px-2 py-0.5 text-[12px] bg-[#f1f1f0] text-[#787774] rounded"
                  >
                    {formatLabel(value)}
                  </span>
                ))}
            </div>
          </article>

          <article class="rounded-lg border border-[#e8e8e7] bg-white p-6">
            <h2 class="mt-0 text-[22px]">Layered Index</h2>
            <div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 mb-[18px]">
              {[
                {
                  label: "Domain",
                  value: item.domain,
                },
                {
                  label: "Document Class",
                  value:
                    item.documentClass ?? descriptor?.documentClass ?? "N/A",
                },
                {
                  label: "Source Host",
                  value: item.sourceHost ?? descriptor?.sourceHost ?? "N/A",
                },
                {
                  label: "Collection",
                  value:
                    item.collectionKey ?? descriptor?.collectionKey ?? "N/A",
                },
                {
                  label: "AI Visibility",
                  value: item.aiVisibility,
                },
                {
                  label: "Sensitivity",
                  value: item.sensitivity,
                },
              ].map((entry) => (
                <div
                  key={entry.label}
                  class="rounded-md bg-[#fafaf9] border border-[#ededec] px-4 py-3.5"
                >
                  <div class="text-[#9b9a97] text-[12px] font-bold uppercase tracking-[0.08em]">
                    {entry.label}
                  </div>
                  <div class="mt-2 text-[#37352f] font-bold break-words">
                    {entry.value}
                  </div>
                </div>
              ))}
            </div>

            <div class="grid gap-3.5">
              <div>
                <h3 class="m-0 mb-2.5 text-[16px]">Topics</h3>
                {descriptor?.topics?.length ? (
                  <div class="flex flex-wrap gap-2">
                    {descriptor.topics.map((topic) => (
                      <span
                        key={topic}
                        class="px-2 py-0.5 text-[12px] bg-[#e8f0fa] text-[#2383e2] rounded"
                      >
                        {formatLabel(topic)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p class="m-0 text-[#787774]">No topic signals yet.</p>
                )}
              </div>

              <div>
                <h3 class="m-0 mb-2.5 text-[16px]">Facets</h3>
                {item.facets?.length ? (
                  <div class="grid gap-2.5">
                    {item.facets.map((facet) => (
                      <div
                        key={facet.id}
                        class="rounded-md bg-[#fafaf9] border border-[#ededec] px-4 py-3.5"
                      >
                        <div class="text-[#9b9a97] text-[12px] font-bold uppercase tracking-[0.08em]">
                          {formatLabel(facet.facetKey)}
                        </div>
                        <div class="mt-1.5 text-[#37352f] font-bold">
                          {facet.facetLabel}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p class="m-0 text-[#787774]">No facet records yet.</p>
                )}
              </div>
            </div>
          </article>

          <article class="rounded-lg border border-[#e8e8e7] bg-white p-6">
            <h2 class="mt-0 text-[22px]">Content</h2>
            <pre class="m-0 whitespace-pre-wrap break-words font-[IBM_Plex_Mono,SFMono-Regular,Consolas,monospace] text-[#37352f] leading-[1.8]">
              {item.contentText ?? "Content has not been stored yet."}
            </pre>
          </article>

          <article class="rounded-lg border border-[#e8e8e7] bg-white p-6">
            <h2 class="mt-0 text-[22px]">Chunks</h2>
            {item.chunks.length === 0 ? (
              <p class="mb-0 text-[#787774]">No chunk records yet.</p>
            ) : (
              <div class="grid gap-3">
                {item.chunks.map((chunk) => (
                  <article
                    key={chunk.id}
                    class="rounded-md bg-[#fafaf9] border border-[#ededec] p-4"
                  >
                    <div class="flex justify-between gap-3 text-[#37352f] font-bold mb-2">
                      <span>Chunk #{chunk.chunkIndex}</span>
                      <span>{chunk.vectorId ?? "No vector"}</span>
                    </div>
                    <p class="m-0 text-[#787774] leading-[1.7]">
                      {chunk.textPreview}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article class="rounded-lg border border-[#e8e8e7] bg-white p-6">
            <h2 class="mt-0 text-[22px]">Assertions</h2>
            {item.assertions?.length ? (
              <div class="grid gap-3">
                {item.assertions.map((assertion) => (
                  <article
                    key={assertion.id}
                    class="rounded-md bg-[#fafaf9] border border-[#ededec] p-4"
                  >
                    <div class="flex flex-wrap justify-between gap-3 mb-2">
                      <span class="text-[#9b9a97] text-[12px] font-extrabold uppercase tracking-[0.08em]">
                        {formatLabel(assertion.kind)}
                      </span>
                      <span class="text-[#787774] text-[13px]">
                        Confidence:{" "}
                        {typeof assertion.confidence === "number"
                          ? assertion.confidence.toFixed(2)
                          : "N/A"}
                      </span>
                    </div>
                    <p class="m-0 text-[#787774] leading-[1.8]">
                      {assertion.text}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p class="mb-0 text-[#787774]">No assertion records yet.</p>
            )}
          </article>
        </div>

        <aside class="grid gap-[18px]">
          <article class="rounded-lg border border-[#e8e8e7] bg-white p-[22px]">
            <h2 class="mt-0 text-[20px]">Manage</h2>
            <form
              action={`/assets/actions/${item.id}/update`}
              method="post"
              class="grid gap-3"
            >
              <label class="grid gap-2">
                <span class="font-bold">Title</span>
                <input
                  name="title"
                  defaultValue={item.title}
                  required
                  class="w-full rounded-md border border-[#e8e8e7] px-3 py-1.5 text-[14px] focus:outline-none focus:border-[#2383e2] box-border"
                />
              </label>
              <label class="grid gap-2">
                <span class="font-bold">Source URL</span>
                <input
                  name="sourceUrl"
                  type="url"
                  defaultValue={item.sourceUrl ?? ""}
                  placeholder="https://example.com"
                  class="w-full rounded-md border border-[#e8e8e7] px-3 py-1.5 text-[14px] focus:outline-none focus:border-[#2383e2] box-border"
                />
              </label>
              <label class="grid gap-2">
                <span class="font-bold">Summary</span>
                <textarea
                  name="summary"
                  defaultValue={item.summary ?? ""}
                  rows={5}
                  class="w-full rounded-md border border-[#e8e8e7] px-3 py-1.5 text-[14px] leading-[1.7] box-border resize-y focus:outline-none focus:border-[#2383e2]"
                />
              </label>
              <button
                type="submit"
                class="bg-[#37352f] text-white hover:bg-[#2f2d28] rounded-md px-3 py-1.5 font-medium cursor-pointer"
              >
                Save Changes
              </button>
            </form>
            <form
              action={`/assets/actions/${item.id}/delete`}
              method="post"
              class="mt-3.5"
            >
              <button
                type="submit"
                class="w-full bg-[#f9e3e3] text-[#9c2e2e] border border-[#e8b7b7] hover:bg-[#f5d4d4] rounded-md px-3 py-1.5 font-medium cursor-pointer"
              >
                Delete Asset
              </button>
            </form>
            <p class="mb-0 text-[#9c2e2e] text-[13px] leading-[1.7]">
              Deletion is soft-delete for now. The asset disappears from list,
              search, and chat results.
            </p>
          </article>

          <article class="rounded-lg border border-[#e8e8e7] bg-white p-[22px]">
            <h2 class="mt-0 text-[20px]">Source</h2>
            <dl class="grid gap-3 m-0">
              <div>
                <dt class="text-[#787774]">Kind</dt>
                <dd class="mt-1.5">
                  {item.source?.kind ?? "No source record yet."}
                </dd>
              </div>
              <div>
                <dt class="text-[#787774]">URL</dt>
                <dd class="mt-1.5 break-words">
                  {item.source?.sourceUrl ?? item.sourceUrl ?? "N/A"}
                </dd>
              </div>
              <div>
                <dt class="text-[#787774]">Raw R2 Key</dt>
                <dd class="mt-1.5 break-words">{item.rawR2Key ?? "N/A"}</dd>
              </div>
            </dl>
          </article>

          <article class="rounded-lg border border-[#e8e8e7] bg-white p-[22px]">
            <h2 class="mt-0 text-[20px]">Processing</h2>
            <div class="grid gap-2.5">
              <div class="text-[#787774]">
                Updated: {formatDate(item.updatedAt)}
              </div>
              <div class="text-[#787774]">
                Processed: {formatDate(item.processedAt)}
              </div>
              <div class="text-[#787774]">MIME: {item.mimeType ?? "N/A"}</div>
              <div class="text-[#787774]">
                Language: {item.language ?? "N/A"}
              </div>
              {isReprocessable ? (
                <form
                  action={`/assets/actions/${item.id}/process`}
                  method="post"
                >
                  <button
                    type="submit"
                    class="mt-2 bg-[#37352f] text-white hover:bg-[#2f2d28] rounded-md px-3 py-1.5 font-medium cursor-pointer"
                  >
                    Reprocess Asset
                  </button>
                </form>
              ) : null}
            </div>
          </article>

          <article class="rounded-lg border border-[#e8e8e7] bg-white p-[22px]">
            <h2 class="mt-0 text-[20px]">Jobs</h2>
            {item.jobs.length === 0 ? (
              <p class="mb-0 text-[#787774]">No job records yet.</p>
            ) : (
              <div class="grid gap-3">
                {item.jobs.map((job) => (
                  <article
                    key={job.id}
                    class="rounded-md bg-[#fafaf9] border border-[#ededec] px-4 py-3.5"
                  >
                    <div class="flex justify-between gap-3 text-[#37352f] font-bold">
                      <span>{job.jobType}</span>
                      <span>{job.status}</span>
                    </div>
                    <div class="mt-2 text-[#787774]">
                      attempt {job.attempt} • {formatDate(job.createdAt)}
                    </div>
                    {job.errorMessage ? (
                      <p class="mb-0 text-[#9c2e2e]">{job.errorMessage}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </article>
        </aside>
      </section>
    </PageShell>
  );
};
