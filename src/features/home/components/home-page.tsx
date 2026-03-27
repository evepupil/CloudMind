import { AssetStatusBadge } from "@/features/assets/components/asset-status-badge";
import type { AssetSummary } from "@/features/assets/model/types";
import { PageShell } from "@/features/layout/components/page-shell";

const overviewMetrics = [
  { label: "Assets indexed", value: "1,248", note: "+32 this week" },
  { label: "Items processing", value: "07", note: "Queue active" },
  { label: "Answer coverage", value: "84%", note: "With evidence" },
  { label: "Failed jobs", value: "02", note: "Needs retry" },
];

const activityFeed: AssetSummary[] = [
  {
    id: "asset-ops-1",
    type: "url",
    title: "Cloudflare Pages deployment notes",
    summary:
      "Collected a deployment decision log covering Pages, D1 bindings, and service boundaries for the MVP.",
    sourceUrl: "https://developers.cloudflare.com/",
    sourceKind: "manual",
    status: "ready",
    domain: "engineering",
    sensitivity: "public",
    aiVisibility: "allow",
    retrievalPriority: 50,
    collectionKey: "site:developers.cloudflare.com",
    capturedAt: new Date().toISOString(),
    descriptorJson: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "asset-ops-2",
    type: "note",
    title: "Knowledge ingestion backlog",
    summary:
      "A short operator note defining what should land in v0.1 before browser extension and export work begin.",
    sourceUrl: null,
    sourceKind: "manual",
    status: "processing",
    domain: "product",
    sensitivity: "internal",
    aiVisibility: "allow",
    retrievalPriority: 20,
    collectionKey: "inbox:notes",
    capturedAt: new Date().toISOString(),
    descriptorJson: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "asset-ops-3",
    type: "chat",
    title: "Ask Library reliability checklist",
    summary:
      "Captured requirements for evidence-first answers, chunk citations, and a stable retrieval loop.",
    sourceUrl: null,
    sourceKind: "mcp",
    status: "pending",
    domain: "engineering",
    sensitivity: "internal",
    aiVisibility: "allow",
    retrievalPriority: 35,
    collectionKey: "inbox:mcp",
    capturedAt: new Date().toISOString(),
    descriptorJson: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const pipelineSteps = [
  {
    title: "Capture",
    copy: "Save URLs, text, PDFs, and future MCP events through one intake layer.",
  },
  {
    title: "Process",
    copy: "Extract, clean, summarize, chunk, embed, and keep every derived artifact rebuildable.",
  },
  {
    title: "Retrieve",
    copy: "Search and Ask should operate on evidence-first retrieval, not fluent guesses.",
  },
];

const actionCards = [
  {
    title: "Open Library",
    description: "Inspect assets, statuses, and summaries.",
    href: "/assets",
  },
  {
    title: "Capture Source",
    description: "Send a webpage, note, or PDF into the ingest pipeline.",
    href: "/capture",
  },
  {
    title: "Ask with Evidence",
    description: "Question the library and verify where the answer came from.",
    href: "/ask",
  },
];

// Notion 风格首页：白底卡片、微边框、小圆角、清晰的文字层级。
export const HomePage = () => {
  return (
    <PageShell
      title="Overview"
      subtitle="Your private knowledge workspace — capture, process, retrieve, and ask with evidence."
      navigationKey="overview"
      actions={
        <>
          <a
            href="/capture"
            class="inline-block px-3 py-1.5 rounded-md bg-[#37352f] text-white text-[14px] font-medium no-underline hover:bg-[#2f2d28] transition-colors"
          >
            New capture
          </a>
          <a
            href="/ask"
            class="inline-block px-3 py-1.5 rounded-md border border-[#e8e8e7] bg-white text-[#37352f] text-[14px] font-medium no-underline hover:bg-[#f1f1f0] transition-colors"
          >
            Open Ask
          </a>
        </>
      }
    >
      {/* --- Two-column: summary + pipeline --- */}
      <section class="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.9fr)] gap-4 mb-4">
        {/* Left: Operator summary card */}
        <article class="p-6 rounded-lg border border-[#e8e8e7] bg-white">
          <h2 class="text-[28px] font-semibold text-[#37352f] leading-tight tracking-tight max-w-[14ch]">
            Build a library that answers with receipts.
          </h2>
          <p class="mt-3 max-w-[66ch] text-[15px] text-[#787774] leading-relaxed">
            The homepage should immediately show what entered the system, what
            still needs processing, and what questions the user can ask next
            without losing trust in the source chain.
          </p>

          {/* Metrics grid */}
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {overviewMetrics.map((metric) => (
              <article
                key={metric.label}
                class="p-4 rounded-md border border-[#ededec] bg-[#fafaf9]"
              >
                <p class="text-[12px] text-[#9b9a97] mb-1">{metric.label}</p>
                <p class="text-[28px] font-semibold text-[#37352f] tracking-tight">
                  {metric.value}
                </p>
                <p class="mt-1 text-[13px] text-[#787774]">{metric.note}</p>
              </article>
            ))}
          </div>
        </article>

        {/* Right: Processing model */}
        <article class="p-5 rounded-lg border border-[#e8e8e7] bg-white">
          <p class="text-[14px] font-semibold text-[#37352f] mb-4">
            Processing model
          </p>
          <div class="flex flex-col gap-0">
            {pipelineSteps.map((step, index) => (
              <div
                key={step.title}
                class={`flex gap-3 py-3 ${index > 0 ? "border-t border-[#ededec]" : ""}`}
              >
                <span class="w-6 h-6 flex-shrink-0 flex items-center justify-center text-[12px] text-[#9b9a97] bg-[#f1f1f0] rounded">
                  {index + 1}
                </span>
                <div class="min-w-0">
                  <h3 class="text-[14px] font-medium text-[#37352f] mb-1">
                    {step.title}
                  </h3>
                  <p class="text-[13px] text-[#787774] leading-relaxed">
                    {step.copy}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* --- Action cards --- */}
      <section class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {actionCards.map((card) => (
          <a
            key={card.title}
            href={card.href}
            class="block p-5 rounded-lg border border-[#e8e8e7] bg-white no-underline text-[#37352f] hover:bg-[#fafaf9] transition-colors"
          >
            <h3 class="text-[16px] font-medium text-[#37352f] mb-2">
              {card.title}
            </h3>
            <p class="text-[14px] text-[#787774] leading-relaxed">
              {card.description}
            </p>
          </a>
        ))}
      </section>

      {/* --- Recent activity --- */}
      <section class="p-6 rounded-lg border border-[#e8e8e7] bg-white">
        <div class="flex items-baseline justify-between gap-3 mb-5 flex-wrap">
          <h2 class="text-[20px] font-semibold text-[#37352f]">
            Recent activity
          </h2>
          <a
            href="/search"
            class="text-[14px] text-[#2383e2] no-underline hover:underline"
          >
            Search across assets
          </a>
        </div>

        <div class="flex flex-col gap-3">
          {activityFeed.map((asset) => (
            <article
              key={asset.id}
              class="flex flex-col sm:flex-row sm:items-start gap-4 p-4 rounded-md border border-[#ededec] bg-[#fafaf9]"
            >
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2 mb-2">
                  <span class="inline-block px-2 py-0.5 text-[12px] text-[#787774] bg-[#f1f1f0] rounded">
                    {asset.type}
                  </span>
                  <AssetStatusBadge status={asset.status} />
                </div>
                <h3 class="text-[15px] font-medium text-[#37352f] mb-1">
                  <a
                    href={`/assets/${asset.id}`}
                    class="no-underline text-[#37352f] hover:text-[#2383e2] transition-colors"
                  >
                    {asset.title}
                  </a>
                </h3>
                <p class="text-[14px] text-[#787774] leading-relaxed">
                  {asset.summary}
                </p>
              </div>
              <div class="flex flex-col gap-2 sm:min-w-[160px]">
                <div class="px-3 py-2 rounded-md bg-white border border-[#ededec] text-[12px] text-[#787774] truncate">
                  {asset.sourceUrl ?? "Local or manual source"}
                </div>
                <a
                  href="/ask"
                  class="block px-3 py-2 rounded-md bg-[#37352f] text-white text-[13px] font-medium no-underline text-center hover:bg-[#2f2d28] transition-colors"
                >
                  Ask from this context
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </PageShell>
  );
};
