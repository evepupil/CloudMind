import type { AskLibraryResult } from "@/features/chat/model/types";
import { PageShell } from "@/features/layout/components/page-shell";

const suggestionPrompts = [
  "Summarize what I saved this week.",
  "Which assets mention Cloudflare deployment tradeoffs?",
  "What should be fixed before the next frontend refactor batch?",
];

const retrievalStages = [
  "Embed the question",
  "Retrieve the highest scoring chunks",
  "Ground the answer in cited evidence",
];

const buildSuggestionHref = (prompt: string): string => {
  return `/ask?question=${encodeURIComponent(prompt)}`;
};

// 这里先把 Ask 重构成更像工作台的问答面板，强调提问、回答和证据三栏关系。
export const AskPage = ({
  question,
  result,
  errorMessage,
}: {
  question: string;
  result: AskLibraryResult | null;
  errorMessage: string | null;
}) => {
  const hasQuestion = question.trim().length > 0;

  return (
    <PageShell
      title="Ask with grounded evidence"
      subtitle="Use retrieval-first answers so CloudMind behaves less like a chatbot and more like a verifiable research operator."
      navigationKey="ask"
      actions={
        <>
          <a
            href="/search"
            class="border border-[#e8e8e7] bg-white text-[#37352f] rounded-md px-3 py-1.5 font-medium hover:bg-[#f1f1f0] transition-colors no-underline"
          >
            Search first
          </a>
          <a
            href="/capture"
            class="border border-[#e8e8e7] bg-white text-[#37352f] rounded-md px-3 py-1.5 font-medium hover:bg-[#f1f1f0] transition-colors no-underline"
          >
            Add more context
          </a>
        </>
      }
    >
      <section class="grid grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)] gap-[18px]">
        {/* 左栏：提问、回答、建议 */}
        <article class="rounded-lg border border-[#e8e8e7] bg-white p-6">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#9b9a97]">
                Answer workspace
              </p>
              <h2 class="m-0 text-[20px] font-bold text-[#37352f]">
                Query, answer, verify
              </h2>
            </div>
            <div class="rounded-md border border-[#ededec] bg-[#fafaf9] px-3 py-2 text-[13px] text-[#787774]">
              Retrieval mode: chunks + summary-only assets
            </div>
          </div>

          <form method="get" action="/ask" class="mb-5 grid gap-3">
            <label class="grid gap-2">
              <span class="text-[14px] font-semibold text-[#37352f]">
                Ask a grounded question
              </span>
              <textarea
                name="question"
                rows={5}
                defaultValue={question}
                placeholder="Ask CloudMind to explain, compare, summarize, or locate something in your saved library..."
                class="w-full rounded-md border border-[#e8e8e7] bg-white px-3 py-2 text-[14px] text-[#37352f] leading-relaxed resize-y font-inherit focus:outline-none focus:border-[#2383e2]"
              />
            </label>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex flex-wrap gap-2.5">
                <button
                  type="submit"
                  class="bg-[#37352f] text-white rounded-md px-4 py-2 font-medium hover:bg-[#2f2d28] transition-colors cursor-pointer border-none"
                >
                  Ask Library
                </button>
                <span class="px-2 py-0.5 text-[12px] bg-[#f1f1f0] text-[#787774] rounded">
                  Evidence required
                </span>
              </div>
              <span class="text-[13px] text-[#9b9a97]">
                Full-page submit for now. AJAX comes next.
              </span>
            </div>
          </form>

          {/* 回答区域 */}
          <div class="grid gap-3.5">
            {hasQuestion ? (
              <article class="rounded-md border border-[#ededec] bg-[#fafaf9] p-4">
                <p class="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#2383e2]">
                  User query
                </p>
                <p class="m-0 text-[15px] leading-7 text-[#37352f]">
                  {question}
                </p>
              </article>
            ) : null}

            <article class="rounded-md border border-[#ededec] bg-white p-5">
              <p class="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-[#9b9a97]">
                CloudMind answer
              </p>
              {errorMessage ? (
                <p class="m-0 text-[15px] leading-7 text-[#9c2e2e]">
                  {errorMessage}
                </p>
              ) : result ? (
                <p class="m-0 text-[15px] leading-7 text-[#37352f]">
                  {result.answer}
                </p>
              ) : (
                <p class="m-0 text-[15px] leading-7 text-[#787774]">
                  Ask a question about your saved material. The answer area is
                  designed to stay readable, with evidence cards alongside it
                  instead of burying sources after the fact.
                </p>
              )}
            </article>
          </div>

          {/* 建议提问 */}
          <div class="mt-5 flex flex-wrap gap-2.5">
            {suggestionPrompts.map((prompt) => (
              <a
                key={prompt}
                href={buildSuggestionHref(prompt)}
                class="rounded-md border border-[#ededec] bg-[#fafaf9] px-3 py-2 text-[13px] text-[#787774] no-underline hover:bg-[#f1f1f0] transition-colors"
              >
                {prompt}
              </a>
            ))}
          </div>
        </article>

        {/* 右栏：证据面板 + 检索链 */}
        <aside class="grid gap-4">
          {/* 证据面板 */}
          <article class="rounded-lg border border-[#e8e8e7] bg-white p-5">
            <p class="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-[#9b9a97]">
              Evidence panel
            </p>
            <h3 class="mb-3 text-[18px] font-bold text-[#37352f]">
              Retrieved sources
            </h3>
            <div class="grid gap-3">
              {result?.sources.length ? (
                result.sources.map((source, index) => (
                  <article
                    key={`${source.assetId}:${source.chunkId ?? "source"}`}
                    class="p-4 rounded-md border border-[#ededec] bg-[#fafaf9]"
                  >
                    <div class="mb-2 flex flex-wrap items-center justify-between gap-2.5">
                      <a
                        href={`/assets/${source.assetId}`}
                        class="font-semibold text-[#2383e2] hover:underline"
                      >
                        {source.title}
                      </a>
                      <span class="px-2 py-0.5 text-[12px] bg-[#f1f1f0] text-[#787774] rounded">
                        {source.sourceType === "chunk"
                          ? `Chunk ${index + 1}`
                          : source.sourceType === "term"
                            ? `Term match ${index + 1}`
                            : `Summary ${index + 1}`}
                      </span>
                    </div>
                    <p class="m-0 text-[14px] leading-relaxed text-[#787774]">
                      {source.snippet}
                    </p>
                    <p class="mt-2.5 text-[12px] text-[#9b9a97]">
                      {source.sourceUrl ?? `Asset ID: ${source.assetId}`}
                    </p>
                  </article>
                ))
              ) : (
                <article class="rounded-md border border-dashed border-[#ededec] bg-white p-4 text-[14px] leading-relaxed text-[#787774]">
                  Submit a question to see retrieved chunks, summary-only
                  sources, and evidence cards here.
                </article>
              )}
            </div>
          </article>

          {/* 检索链 */}
          <article class="rounded-lg border border-[#e8e8e7] bg-white p-5">
            <p class="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-[#2383e2]">
              Retrieval chain
            </p>
            <div class="grid gap-3">
              {retrievalStages.map((stage, index) => (
                <div
                  key={stage}
                  class="grid grid-cols-[26px_minmax(0,1fr)] gap-3 items-start"
                >
                  <span class="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full border border-[#ededec] bg-white text-[12px] font-bold text-[#2383e2]">
                    {index + 1}
                  </span>
                  <p class="m-0 mt-0.5 text-[14px] leading-relaxed text-[#37352f]">
                    {stage}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </PageShell>
  );
};
