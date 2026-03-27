import type {
  AssetAiVisibility,
  AssetDocumentClass,
  AssetDomain,
  AssetListQuery,
  AssetListResult,
  AssetSourceKind,
  AssetStatus,
  AssetSummary,
  AssetType,
} from "@/features/assets/model/types";
import { PageShell } from "@/features/layout/components/page-shell";

import { AssetStatusBadge } from "./asset-status-badge";

const assetStatusOptions: Array<{ label: string; value: AssetStatus | "" }> = [
  { label: "All status", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "Ready", value: "ready" },
  { label: "Failed", value: "failed" },
];

const assetTypeOptions: Array<{ label: string; value: AssetType | "" }> = [
  { label: "All types", value: "" },
  { label: "URL", value: "url" },
  { label: "PDF", value: "pdf" },
  { label: "Note", value: "note" },
  { label: "Image", value: "image" },
  { label: "Chat", value: "chat" },
];

const assetDomainOptions: Array<{ label: string; value: AssetDomain | "" }> = [
  { label: "All domains", value: "" },
  { label: "Engineering", value: "engineering" },
  { label: "Product", value: "product" },
  { label: "Research", value: "research" },
  { label: "Personal", value: "personal" },
  { label: "Finance", value: "finance" },
  { label: "Health", value: "health" },
  { label: "Archive", value: "archive" },
  { label: "General", value: "general" },
];

const assetDocumentClassOptions: Array<{
  label: string;
  value: AssetDocumentClass | "";
}> = [
  { label: "All document classes", value: "" },
  { label: "Reference Doc", value: "reference_doc" },
  { label: "Design Doc", value: "design_doc" },
  { label: "Bug Note", value: "bug_note" },
  { label: "Paper", value: "paper" },
  { label: "Journal Entry", value: "journal_entry" },
  { label: "Meeting Note", value: "meeting_note" },
  { label: "Spec", value: "spec" },
  { label: "How-to", value: "howto" },
  { label: "General Note", value: "general_note" },
];

const assetSourceKindOptions: Array<{
  label: string;
  value: AssetSourceKind | "";
}> = [
  { label: "All source kinds", value: "" },
  { label: "Manual", value: "manual" },
  { label: "Browser Extension", value: "browser_extension" },
  { label: "Upload", value: "upload" },
  { label: "MCP", value: "mcp" },
  { label: "Import", value: "import" },
];

const assetAiVisibilityOptions: Array<{
  label: string;
  value: AssetAiVisibility | "";
}> = [
  { label: "All visibility", value: "" },
  { label: "Allow", value: "allow" },
  { label: "Summary Only", value: "summary_only" },
  { label: "Deny", value: "deny" },
];

interface AssetDescriptorView {
  topics?: string[] | undefined;
}

const formatDate = (value: string): string => {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
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
      topics: Array.isArray(parsed.topics)
        ? parsed.topics.filter(
            (topic: unknown): topic is string => typeof topic === "string"
          )
        : [],
    };
  } catch {
    return null;
  }
};

const buildAssetTags = (asset: AssetSummary): string[] => {
  const descriptor = parseDescriptorJson(asset.descriptorJson);
  const tags = [
    asset.domain,
    asset.documentClass ?? null,
    asset.aiVisibility,
    asset.sourceKind,
    asset.sourceHost,
    ...(descriptor?.topics ?? []),
  ].filter((value): value is string => Boolean(value?.trim()));

  return Array.from(new Set(tags));
};

const buildFilterSummary = (filters: AssetListQuery): string => {
  const segments = [];

  if (filters.status) {
    segments.push(`status: ${filters.status}`);
  }

  if (filters.type) {
    segments.push(`type: ${filters.type}`);
  }

  if (filters.domain) {
    segments.push(`domain: ${filters.domain}`);
  }

  if (filters.documentClass) {
    segments.push(`document: ${filters.documentClass}`);
  }

  if (filters.sourceKind) {
    segments.push(`source: ${filters.sourceKind}`);
  }

  if (filters.aiVisibility) {
    segments.push(`visibility: ${filters.aiVisibility}`);
  }

  if (filters.sourceHost) {
    segments.push(`host: ${filters.sourceHost}`);
  }

  if (filters.query) {
    segments.push(`query: ${filters.query}`);
  }

  return segments.length > 0 ? segments.join(" \u2022 ") : "All assets";
};

// 这里重做 Library 页原型，让它先具备知识浏览器的结构，而不是表单堆叠页。
export const AssetsPage = ({
  items,
  pagination,
  filters,
  errorMessage,
  flashMessage,
}: {
  items: AssetSummary[];
  pagination: AssetListResult["pagination"];
  filters: AssetListQuery;
  errorMessage?: string | undefined;
  flashMessage?: string | undefined;
}) => {
  const previousPage = pagination.page > 1 ? pagination.page - 1 : null;
  const nextPage =
    pagination.page < pagination.totalPages ? pagination.page + 1 : null;
  const currentParams = new URLSearchParams();

  if (filters.status) {
    currentParams.set("status", filters.status);
  }

  if (filters.type) {
    currentParams.set("type", filters.type);
  }

  if (filters.domain) {
    currentParams.set("domain", filters.domain);
  }

  if (filters.documentClass) {
    currentParams.set("documentClass", filters.documentClass);
  }

  if (filters.sourceKind) {
    currentParams.set("sourceKind", filters.sourceKind);
  }

  if (filters.aiVisibility) {
    currentParams.set("aiVisibility", filters.aiVisibility);
  }

  if (filters.sourceHost) {
    currentParams.set("sourceHost", filters.sourceHost);
  }

  if (filters.query) {
    currentParams.set("query", filters.query);
  }

  if (filters.pageSize) {
    currentParams.set("pageSize", String(filters.pageSize));
  }

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams(currentParams);
    params.set("page", String(page));

    return `/assets?${params.toString()}`;
  };

  return (
    <PageShell
      title="Library"
      subtitle="Browse your saved knowledge as a living library. Filter by type and state, then jump into detail or keep capturing new material."
      navigationKey="library"
      actions={
        <div class="flex gap-2">
          <a
            href="/capture"
            class="inline-flex items-center rounded-md bg-[#37352f] px-4 py-2 text-[14px] font-bold text-white no-underline hover:bg-[#2f2d28]"
          >
            Capture New
          </a>
          <a
            href="/ask"
            class="inline-flex items-center rounded-md border border-[#e8e8e7] bg-white px-4 py-2 text-[14px] font-bold text-[#37352f] no-underline hover:bg-[#f1f1f0]"
          >
            Ask Library
          </a>
        </div>
      }
    >
      {flashMessage ? (
        <section class="mb-4 rounded-lg border border-[#b7dbbf] bg-[#e3f2e8] px-4 py-3 text-[#2e6c3e]">
          {flashMessage}
        </section>
      ) : null}

      {errorMessage ? (
        <section class="mb-4 rounded-lg border border-[#e8b7b7] bg-[#f9e3e3] px-4 py-3 text-[#9c2e2e]">
          {errorMessage}
        </section>
      ) : null}

      <section class="mb-5 grid grid-cols-[minmax(0,0.9fr)_minmax(260px,0.45fr)] gap-4">
        <article class="rounded-lg border border-[#e8e8e7] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 class="m-0 text-[24px] font-semibold text-[#37352f]">
            {pagination.total} assets
          </h2>
          <p class="mt-2 leading-relaxed text-[#787774]">
            {buildFilterSummary(filters)}
          </p>
        </article>

        <article class="rounded-lg border border-[#e8e8e7] bg-white p-5">
          <h2 class="mt-0 text-[16px] font-semibold text-[#37352f]">
            Use this page to
          </h2>
          <ul class="m-0 list-disc pl-5 leading-loose text-[#787774]">
            <li>Scan recent knowledge at a glance</li>
            <li>Filter by type, domain, visibility, and source</li>
            <li>Jump to detail or keep capturing new material</li>
          </ul>
        </article>
      </section>

      <section class="mb-5 rounded-lg border border-[#e8e8e7] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <form
          method="get"
          action="/assets"
          class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3"
        >
          <label class="grid gap-2">
            <span class="text-[13px] font-semibold text-[#37352f]">Status</span>
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              class="w-full rounded-md border border-[#e8e8e7] px-3 py-1.5 text-[14px] text-[#37352f] focus:outline-none focus:border-[#2383e2]"
            >
              {assetStatusOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label class="grid gap-2">
            <span class="text-[13px] font-semibold text-[#37352f]">Type</span>
            <select
              name="type"
              defaultValue={filters.type ?? ""}
              class="w-full rounded-md border border-[#e8e8e7] px-3 py-1.5 text-[14px] text-[#37352f] focus:outline-none focus:border-[#2383e2]"
            >
              {assetTypeOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label class="grid gap-2">
            <span class="text-[13px] font-semibold text-[#37352f]">Domain</span>
            <select
              name="domain"
              defaultValue={filters.domain ?? ""}
              class="w-full rounded-md border border-[#e8e8e7] px-3 py-1.5 text-[14px] text-[#37352f] focus:outline-none focus:border-[#2383e2]"
            >
              {assetDomainOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label class="grid gap-2">
            <span class="text-[13px] font-semibold text-[#37352f]">
              Document Class
            </span>
            <select
              name="documentClass"
              defaultValue={filters.documentClass ?? ""}
              class="w-full rounded-md border border-[#e8e8e7] px-3 py-1.5 text-[14px] text-[#37352f] focus:outline-none focus:border-[#2383e2]"
            >
              {assetDocumentClassOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label class="grid gap-2">
            <span class="text-[13px] font-semibold text-[#37352f]">
              Source Kind
            </span>
            <select
              name="sourceKind"
              defaultValue={filters.sourceKind ?? ""}
              class="w-full rounded-md border border-[#e8e8e7] px-3 py-1.5 text-[14px] text-[#37352f] focus:outline-none focus:border-[#2383e2]"
            >
              {assetSourceKindOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label class="grid gap-2">
            <span class="text-[13px] font-semibold text-[#37352f]">
              AI Visibility
            </span>
            <select
              name="aiVisibility"
              defaultValue={filters.aiVisibility ?? ""}
              class="w-full rounded-md border border-[#e8e8e7] px-3 py-1.5 text-[14px] text-[#37352f] focus:outline-none focus:border-[#2383e2]"
            >
              {assetAiVisibilityOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label class="grid gap-2">
            <span class="text-[13px] font-semibold text-[#37352f]">
              Source Host
            </span>
            <input
              name="sourceHost"
              type="search"
              defaultValue={filters.sourceHost ?? ""}
              placeholder="developers.cloudflare.com"
              class="w-full rounded-md border border-[#e8e8e7] px-3 py-1.5 text-[14px] text-[#37352f] focus:outline-none focus:border-[#2383e2]"
            />
          </label>
          <label class="grid gap-2">
            <span class="text-[13px] font-semibold text-[#37352f]">Search</span>
            <input
              name="query"
              type="search"
              defaultValue={filters.query ?? ""}
              placeholder="Title, summary, or source URL"
              class="w-full rounded-md border border-[#e8e8e7] px-3 py-1.5 text-[14px] text-[#37352f] focus:outline-none focus:border-[#2383e2]"
            />
          </label>
          <div class="flex flex-wrap items-end gap-2">
            <button
              type="submit"
              class="cursor-pointer rounded-md border-none bg-[#37352f] px-4 py-2 text-[14px] font-bold text-white hover:bg-[#2f2d28]"
            >
              Apply
            </button>
            <a
              href="/assets"
              class="text-[14px] font-bold text-[#787774] no-underline hover:text-[#37352f]"
            >
              Reset
            </a>
          </div>
        </form>
      </section>

      {pagination.totalPages > 1 ? (
        <div class="mb-4 flex items-center justify-between gap-3">
          <span class="text-[14px] text-[#787774]">
            Page {pagination.page} / {pagination.totalPages}
          </span>
          <div class="flex gap-3">
            {previousPage ? (
              <a
                href={buildPageHref(previousPage)}
                class="text-[14px] font-semibold text-[#2383e2] no-underline hover:underline"
              >
                Previous
              </a>
            ) : (
              <span class="text-[14px] text-[#9b9a97]">Previous</span>
            )}
            {nextPage ? (
              <a
                href={buildPageHref(nextPage)}
                class="text-[14px] font-semibold text-[#2383e2] no-underline hover:underline"
              >
                Next
              </a>
            ) : (
              <span class="text-[14px] text-[#9b9a97]">Next</span>
            )}
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <article class="rounded-lg border border-dashed border-[#e8e8e7] bg-white p-6 text-[#787774]">
          Your library is still empty. Start from{" "}
          <a
            href="/capture"
            class="text-[#2383e2] no-underline hover:underline"
          >
            Capture
          </a>{" "}
          and bring in your first URL, note, or PDF.
        </article>
      ) : (
        <div class="grid gap-3">
          {items.map((asset) => (
            <article
              key={asset.id}
              class="rounded-lg border border-[#e8e8e7] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              {buildAssetTags(asset).length > 0 ? (
                <div class="mb-3 flex flex-wrap gap-1.5">
                  {buildAssetTags(asset).map((tag) => (
                    <span
                      key={`${asset.id}:${tag}`}
                      class="rounded bg-[#f1f1f0] px-2 py-0.5 text-[12px] text-[#787774]"
                    >
                      {formatLabel(tag)}
                    </span>
                  ))}
                </div>
              ) : null}
              <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <a
                    href={`/assets/${asset.id}`}
                    class="text-[16px] font-semibold text-[#37352f] no-underline hover:text-[#2383e2]"
                  >
                    {asset.title}
                  </a>
                  <div class="mt-1 text-[13px] text-[#787774]">
                    {asset.type} &bull; Created {formatDate(asset.createdAt)}
                  </div>
                </div>
                <AssetStatusBadge status={asset.status} />
              </div>
              <p class="mb-2 leading-relaxed text-[#787774]">
                {asset.summary ??
                  "Summary has not been generated yet. This record is currently showing raw metadata."}
              </p>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="text-[13px] text-[#9b9a97]">
                  {asset.sourceHost ??
                    asset.sourceUrl ??
                    `Asset ID: ${asset.id}`}
                </div>
                <div class="flex gap-3">
                  <a
                    href={`/assets/${asset.id}`}
                    class="text-[14px] font-semibold text-[#2383e2] no-underline hover:underline"
                  >
                    Open Detail
                  </a>
                  <a
                    href="/ask"
                    class="text-[14px] font-semibold text-[#2383e2] no-underline hover:underline"
                  >
                    Ask From Here
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
};
