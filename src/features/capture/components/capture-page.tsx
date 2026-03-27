import { PageShell } from "@/features/layout/components/page-shell";

type CaptureMode = "url" | "text" | "pdf";

const modes: Array<{
  key: CaptureMode;
  label: string;
  description: string;
}> = [
  {
    key: "url",
    label: "Save URL",
    description:
      "Store a webpage link and send it into the processing pipeline.",
  },
  {
    key: "text",
    label: "Paste Text",
    description: "Capture notes, excerpts, and copied conversations directly.",
  },
  {
    key: "pdf",
    label: "Upload PDF",
    description:
      "Send a document into blob storage and process it asynchronously.",
  },
];

const renderForm = (mode: CaptureMode) => {
  if (mode === "url") {
    return (
      <form
        action="/assets/actions/ingest-url"
        method="post"
        class="grid gap-4"
      >
        <label class="grid gap-2">
          <span class="font-bold text-ink">Title</span>
          <input
            name="title"
            type="text"
            placeholder="Optional title"
            class="rounded-md border border-line bg-white px-3 py-1.5 text-[14px] text-ink focus:outline-none focus:border-accent"
          />
        </label>
        <label class="grid gap-2">
          <span class="font-bold text-ink">URL</span>
          <input
            name="url"
            type="url"
            placeholder="https://example.com/article"
            class="rounded-md border border-line bg-white px-3 py-1.5 text-[14px] text-ink focus:outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          class="w-fit bg-ink text-white rounded-md px-4 py-2 font-medium hover:bg-[#2f2d28] transition-colors cursor-pointer"
        >
          Save URL
        </button>
      </form>
    );
  }

  if (mode === "pdf") {
    return (
      <form
        action="/assets/actions/ingest-file"
        method="post"
        encType="multipart/form-data"
        class="grid gap-4"
      >
        <label class="grid gap-2">
          <span class="font-bold text-ink">Title</span>
          <input
            name="title"
            type="text"
            placeholder="Optional title"
            class="rounded-md border border-line bg-white px-3 py-1.5 text-[14px] text-ink focus:outline-none focus:border-accent"
          />
        </label>
        <label class="grid gap-2">
          <span class="font-bold text-ink">PDF File</span>
          <input
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            class="rounded-md border border-line bg-white px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          class="w-fit bg-ink text-white rounded-md px-4 py-2 font-medium hover:bg-[#2f2d28] transition-colors cursor-pointer"
        >
          Upload PDF
        </button>
      </form>
    );
  }

  return (
    <form action="/assets/actions/ingest-text" method="post" class="grid gap-4">
      <label class="grid gap-2">
        <span class="font-bold text-ink">Title</span>
        <input
          name="title"
          type="text"
          placeholder="Weekly research notes"
          class="rounded-md border border-line bg-white px-3 py-1.5 text-[14px] text-ink focus:outline-none focus:border-accent"
        />
      </label>
      <label class="grid gap-2">
        <span class="font-bold text-ink">Content</span>
        <textarea
          name="content"
          placeholder="Paste notes, article excerpts, or chat summaries here."
          rows={8}
          class="resize-y rounded-md border border-line bg-white px-3 py-1.5 text-[14px] text-ink focus:outline-none focus:border-accent"
        />
      </label>
      <button
        type="submit"
        class="w-fit bg-ink text-white rounded-md px-4 py-2 font-medium hover:bg-[#2f2d28] transition-colors cursor-pointer"
      >
        Save Text
      </button>
    </form>
  );
};

// 这里提供统一 Capture 页原型，用同一个空间承载 URL、文本和 PDF 采集。
export const CapturePage = ({ mode }: { mode: CaptureMode }) => {
  return (
    <PageShell
      title="Capture new knowledge"
      subtitle="Bring webpages, notes, and PDFs into CloudMind through one calm entry point instead of scattered forms."
      navigationKey="capture"
      actions={
        <a
          href="/assets"
          class="border border-line bg-white text-ink rounded-md px-4 py-2 font-medium hover:bg-[#f1f1f0] transition-colors no-underline"
        >
          Open Library
        </a>
      }
    >
      <section
        class="grid gap-4"
        style="grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.7fr)"
      >
        <article class="rounded-lg border border-line bg-white p-6 shadow-card">
          <div class="flex flex-wrap gap-2 mb-5">
            {modes.map((item) => (
              <a
                key={item.key}
                href={`/capture?mode=${item.key}`}
                class={
                  "px-4 py-2 rounded-md no-underline font-medium transition-colors " +
                  (item.key === mode
                    ? "bg-ink text-white"
                    : "text-ink-soft hover:bg-[#f1f1f0]")
                }
              >
                {item.label}
              </a>
            ))}
          </div>
          <h2 class="mt-0 text-2xl text-ink">
            {modes.find((item) => item.key === mode)?.label}
          </h2>
          <p class="mt-0 mb-5 text-ink-soft">
            {modes.find((item) => item.key === mode)?.description}
          </p>
          {renderForm(mode)}
        </article>

        <aside class="grid gap-4">
          <article class="rounded-lg border border-line bg-white p-5">
            <h3 class="mt-0 text-xl text-ink">Capture Rules</h3>
            <ul class="m-0 pl-[18px] text-ink-soft leading-8">
              <li>Always keep original assets recoverable.</li>
              <li>AI-derived summaries should remain recomputable.</li>
              <li>Prefer fast ingest over over-designed workflows.</li>
            </ul>
          </article>

          <article class="rounded-lg border border-line bg-white p-5">
            <h3 class="mt-0 text-xl text-ink">After saving</h3>
            <p class="m-0 text-ink-soft leading-8">
              Assets enter the processing pipeline, become searchable, and can
              later feed Ask Library with traceable sources.
            </p>
          </article>
        </aside>
      </section>
    </PageShell>
  );
};
