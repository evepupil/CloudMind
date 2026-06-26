import { PageShell } from "@/features/layout/components/page-shell";
import { buttonClass, Panel } from "@/features/ui/components";

type CaptureMode = "url" | "text" | "pdf";

const modes: Array<{
  key: CaptureMode;
  label: string;
  description: string;
}> = [
  {
    key: "text",
    label: "粘贴文本",
    description: "直接收录笔记、摘录、复制的对话，或 AI 生成的高密度记忆。",
  },
  {
    key: "url",
    label: "保存 URL",
    description: "存一个网页链接，送进处理流水线抓取与清洗。",
  },
  {
    key: "pdf",
    label: "上传 PDF",
    description: "把文档送进 R2 存储并异步抽取正文。",
  },
];

const inputClass =
  "w-full rounded-md border border-line bg-ink-raised px-3 py-2 text-[14px] text-bone outline-none transition-colors placeholder:text-bone-faint focus:border-brass";
const fieldLabel = "text-[12px] font-medium text-bone-soft";

const renderForm = (mode: CaptureMode) => {
  if (mode === "url") {
    return (
      <form
        action="/assets/actions/ingest-url"
        method="post"
        class="grid gap-4"
      >
        <label class="grid gap-1.5">
          <span class={fieldLabel}>标题（可选）</span>
          <input
            name="title"
            type="text"
            placeholder="给这条记忆起个名"
            class={inputClass}
          />
        </label>
        <label class="grid gap-1.5">
          <span class={fieldLabel}>URL</span>
          <input
            name="url"
            type="url"
            required
            placeholder="https://example.com/article"
            class={inputClass}
          />
        </label>
        <button type="submit" class={`w-fit ${buttonClass("primary")}`}>
          保存 URL
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
        <label class="grid gap-1.5">
          <span class={fieldLabel}>标题（可选）</span>
          <input
            name="title"
            type="text"
            placeholder="给这份文档起个名"
            class={inputClass}
          />
        </label>
        <label class="grid gap-1.5">
          <span class={fieldLabel}>PDF 文件</span>
          <input
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            required
            class={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-brass file:px-3 file:py-1 file:text-on-brass`}
          />
        </label>
        <button type="submit" class={`w-fit ${buttonClass("primary")}`}>
          上传 PDF
        </button>
      </form>
    );
  }

  return (
    <form action="/assets/actions/ingest-text" method="post" class="grid gap-4">
      <label class="grid gap-1.5">
        <span class={fieldLabel}>标题（可选）</span>
        <input
          name="title"
          type="text"
          placeholder="本周研究笔记"
          class={inputClass}
        />
      </label>
      <label class="grid gap-1.5">
        <span class={fieldLabel}>正文</span>
        <textarea
          name="content"
          required
          placeholder="粘贴笔记、文章摘录、对话总结，或一段 AI 生成的高密度记忆。"
          rows={9}
          class={`${inputClass} resize-y leading-relaxed`}
        />
      </label>
      <button type="submit" class={`w-fit ${buttonClass("primary")}`}>
        收录文本
      </button>
    </form>
  );
};

// 统一采集「收件箱」：URL / 文本 / PDF 用 segmented 切换，同一空间承载。
export const CapturePage = ({ mode }: { mode: CaptureMode }) => {
  const active = modes.find((item) => item.key === mode) ?? modes[0];

  return (
    <PageShell
      navigationKey="capture"
      eyebrow="工作区 · 采集"
      title={
        <>
          收一条<em class="italic text-brass">记忆</em>进来
        </>
      }
      subtitle="把网页、笔记、PDF 收进 CloudMind——一个安静的入口，而不是散落的表单。"
      actions={
        <a class={buttonClass("subtle")} href="/assets">
          ← 记忆库
        </a>
      }
    >
      <section class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <Panel class="p-6" variant="panel">
          {/* segmented 切换 */}
          <div class="mb-5 inline-flex gap-1 rounded-lg border border-line bg-ink-raised p-1">
            {modes.map((item) => (
              <a
                key={item.key}
                href={`/capture?mode=${item.key}`}
                class={`rounded-md px-4 py-1.5 text-[13.5px] font-medium no-underline transition-colors ${
                  item.key === mode
                    ? "bg-brass text-on-brass"
                    : "text-bone-soft hover:bg-[rgba(236,228,212,0.04)] hover:text-bone"
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
          <h2 class="font-display text-[22px] font-semibold text-bone">
            {active?.label}
          </h2>
          <p class="mb-5 mt-1.5 text-[14px] leading-relaxed text-bone-soft">
            {active?.description}
          </p>
          {renderForm(mode)}
        </Panel>

        <aside class="flex flex-col gap-4">
          <Panel class="p-5" variant="panel">
            <h3 class="mb-2.5 font-display text-[17px] font-semibold text-bone">
              采集原则
            </h3>
            <ul class="m-0 grid gap-2 pl-[18px] text-[13px] leading-relaxed text-bone-soft">
              <li>原始资产始终可恢复。</li>
              <li>AI 派生的摘要保持可重算。</li>
              <li>优先快速入库，而非过度设计流程。</li>
            </ul>
          </Panel>

          <Panel class="p-5" variant="panel">
            <h3 class="mb-2.5 font-display text-[17px] font-semibold text-bone">
              收录之后
            </h3>
            <p class="m-0 text-[13px] leading-relaxed text-bone-soft">
              资产进入处理流水线，变得可检索，之后可作为带来源的证据喂给问答。
            </p>
          </Panel>
        </aside>
      </section>
    </PageShell>
  );
};
