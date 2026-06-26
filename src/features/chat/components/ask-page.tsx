import type { AskLibraryResult } from "@/features/chat/model/types";
import { PageShell } from "@/features/layout/components/page-shell";
import { buttonClass, EmptyState, Panel } from "@/features/ui/components";

const suggestionPrompts = [
  "总结我这周收录了什么。",
  "哪些记忆提到了 scope 隔离的决策？",
  "下一批前端重构前应该先修什么？",
];

const retrievalStages = [
  "把问题向量化",
  "检索得分最高的切块与摘要",
  "用带引用的证据生成回答",
];

const buildSuggestionHref = (prompt: string): string =>
  `/ask?question=${encodeURIComponent(prompt)}`;

// 问答工作台：左提问+回答，右证据面板+检索链，强调「答案带可验证来源」。
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
      navigationKey="ask"
      eyebrow="工作区 · 问答"
      title={
        <>
          带<em class="italic text-brass">证据</em>地问
        </>
      }
      subtitle="检索优先的回答，让 CloudMind 不像聊天机器人，更像一个可核验的研究助手。"
      actions={
        <>
          <a class={buttonClass("subtle")} href="/search">
            先搜索
          </a>
          <a class={buttonClass("subtle")} href="/capture">
            + 补充上下文
          </a>
        </>
      }
    >
      <section class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
        {/* 左栏：提问、回答、建议 */}
        <Panel class="p-6" variant="panel">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p class="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-faint">
                Answer workspace
              </p>
              <h2 class="font-display text-[20px] font-semibold text-bone">
                提问 · 回答 · 核验
              </h2>
            </div>
            <div class="rounded-md border border-line bg-ink-raised px-3 py-2 font-mono text-[11px] text-bone-soft">
              检索模式：切块 + 摘要资产
            </div>
          </div>

          <form method="get" action="/ask" class="mb-5 grid gap-3">
            <label class="grid gap-1.5">
              <span class="text-[13px] font-medium text-bone-soft">
                问一个有据可查的问题
              </span>
              <textarea
                name="question"
                rows={5}
                defaultValue={question}
                placeholder="让 CloudMind 解释、对比、总结，或在你收录的记忆里定位某个东西…"
                class="w-full resize-y rounded-md border border-line bg-ink-raised px-3 py-2 text-[14px] leading-relaxed text-bone outline-none transition-colors placeholder:text-bone-faint focus:border-brass"
              />
            </label>
            <div class="flex flex-wrap items-center gap-3">
              <button type="submit" class={buttonClass("primary")}>
                ? 问知识库
              </button>
              <span class="rounded bg-ink-raised px-2 py-0.5 font-mono text-[11px] text-bone-soft">
                证据必备
              </span>
            </div>
          </form>

          {/* 回答区域 */}
          <div class="grid gap-3.5">
            {hasQuestion ? (
              <div class="rounded-md border border-line bg-ink-raised p-4">
                <p class="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-brass">
                  你的问题
                </p>
                <p class="text-[15px] leading-7 text-bone">{question}</p>
              </div>
            ) : null}

            <div class="rounded-md border border-line bg-ink-panel p-5">
              <p class="mb-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-faint">
                CloudMind 回答
              </p>
              {errorMessage ? (
                <p class="text-[15px] leading-7 text-status-failed">
                  {errorMessage}
                </p>
              ) : result ? (
                <p class="whitespace-pre-wrap text-[15px] leading-7 text-bone">
                  {result.answer}
                </p>
              ) : (
                <p class="text-[15px] leading-7 text-bone-soft">
                  问一个关于你收录材料的问题。回答区会保持可读，证据卡片在一旁同时呈现，而不是事后才补上来源。
                </p>
              )}
            </div>
          </div>

          {/* 建议提问 */}
          <div class="mt-5 flex flex-wrap gap-2.5">
            {suggestionPrompts.map((prompt) => (
              <a
                key={prompt}
                href={buildSuggestionHref(prompt)}
                class="rounded-md border border-line bg-ink-raised px-3 py-2 text-[13px] text-bone-soft no-underline transition-colors hover:border-brass/40 hover:text-bone"
              >
                {prompt}
              </a>
            ))}
          </div>
        </Panel>

        {/* 右栏：证据面板 + 检索链 */}
        <aside class="flex flex-col gap-4">
          <Panel class="p-5" variant="panel">
            <p class="mb-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-faint">
              Evidence panel
            </p>
            <h3 class="mb-3 font-display text-[18px] font-semibold text-bone">
              检索到的来源
            </h3>
            <div class="grid gap-3">
              {result?.sources.length ? (
                result.sources.map((source, index) => (
                  <div
                    key={`${source.assetId}:${source.chunkId ?? "source"}`}
                    class="rounded-md border border-line bg-ink-raised p-4"
                  >
                    <div class="mb-2 flex flex-wrap items-center justify-between gap-2.5">
                      <a
                        href={`/assets/${source.assetId}`}
                        class="font-semibold text-brass no-underline hover:text-brass-bright"
                      >
                        {source.title}
                      </a>
                      <span class="rounded bg-ink-panel px-2 py-0.5 font-mono text-[10.5px] text-bone-soft">
                        {source.sourceType === "chunk"
                          ? `切块 ${index + 1}`
                          : `摘要 ${index + 1}`}
                      </span>
                    </div>
                    <p class="text-[13.5px] leading-relaxed text-bone-soft">
                      {source.snippet}
                    </p>
                    <p class="mt-2.5 truncate font-mono text-[11px] text-bone-faint">
                      {source.sourceUrl ?? `ID: ${source.assetId}`}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="提交问题后在此看到证据"
                  description="检索到的切块、仅摘要来源与证据卡片会出现在这里。"
                />
              )}
            </div>
          </Panel>

          <Panel class="p-5" variant="panel">
            <p class="mb-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-brass">
              检索链
            </p>
            <div class="grid gap-3">
              {retrievalStages.map((stage, index) => (
                <div
                  key={stage}
                  class="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-3"
                >
                  <span class="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full border border-line bg-ink-raised font-mono text-[12px] font-medium text-brass">
                    {index + 1}
                  </span>
                  <p class="mt-0.5 text-[13.5px] leading-relaxed text-bone">
                    {stage}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </section>
    </PageShell>
  );
};
