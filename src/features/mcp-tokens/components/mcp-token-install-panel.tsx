import {
  buildMcpConfigSnippet,
  buildMcpInstallPrompt,
  MCP_INSTALL_TARGETS,
} from "@/features/mcp-tokens/model/install-instructions";
import { buttonClass } from "@/features/ui/components";

const segmentClass =
  "rounded-md px-3 py-1.5 text-[13px] font-medium text-bone-soft transition-colors hover:text-bone aria-selected:bg-brass aria-selected:text-on-brass";

const outputClass =
  "h-80 w-full resize-y rounded-md border border-line bg-ink px-3 py-3 font-mono text-[12px] leading-relaxed text-bone-soft outline-none focus:border-brass";

const selectClass =
  "h-9 rounded-md border border-line bg-ink px-3 text-[13px] text-bone outline-none focus:border-brass";

const installPanelScript = `
if (!window.__cloudmindMcpInstallBound) {
  window.__cloudmindMcpInstallBound = true;

  document.addEventListener("click", async function (event) {
    var target = event.target;
    if (!(target instanceof Element)) return;

    var modeButton = target.closest("[data-install-mode]");
    if (modeButton instanceof HTMLButtonElement) {
      var modePanel = modeButton.closest("[data-mcp-install]");
      if (!modePanel) return;
      var mode = modeButton.dataset.installMode;
      modePanel.querySelectorAll("[data-install-mode]").forEach(function (button) {
        button.setAttribute("aria-selected", String(button === modeButton));
      });
      modePanel.querySelectorAll("[data-install-content]").forEach(function (content) {
        content.hidden = content.getAttribute("data-install-content") !== mode;
      });
      return;
    }

    var copyButton = target.closest("[data-copy-install]");
    if (!(copyButton instanceof HTMLButtonElement)) return;
    var copyPanel = copyButton.closest("[data-mcp-install]");
    if (!copyPanel) return;
    var visibleContent = Array.from(copyPanel.querySelectorAll("[data-install-content]")).find(function (content) {
      return !content.hidden;
    });
    if (!visibleContent) return;
    var visibleTarget = Array.from(visibleContent.querySelectorAll("[data-install-target]")).find(function (content) {
      return !content.hidden;
    });
    var textarea = (visibleTarget || visibleContent).querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) return;

    var originalLabel = copyButton.textContent || "复制";
    try {
      await navigator.clipboard.writeText(textarea.value);
      copyButton.textContent = "已复制";
    } catch {
      textarea.focus();
      textarea.select();
      copyButton.textContent = "请手动复制";
    }
    window.setTimeout(function () {
      copyButton.textContent = originalLabel;
    }, 1600);
  });

  document.addEventListener("change", function (event) {
    var select = event.target;
    if (!(select instanceof HTMLSelectElement) || !select.matches("[data-install-client]")) return;
    var panel = select.closest("[data-mcp-install]");
    if (!panel) return;
    panel.querySelectorAll("[data-install-target]").forEach(function (content) {
      content.hidden = content.getAttribute("data-install-target") !== select.value;
    });
  });
}
`;

export const McpTokenInstallPanel = ({
  endpointUrl,
  tokenValue,
}: {
  endpointUrl: string;
  tokenValue: string;
}) => (
  <div data-mcp-install>
    <div
      class="inline-flex gap-1 rounded-lg border border-line bg-ink p-1"
      role="tablist"
      aria-label="安装内容"
    >
      <button
        type="button"
        role="tab"
        class={segmentClass}
        data-install-mode="prompt"
        aria-selected="true"
      >
        给 AI 的提示词
      </button>
      <button
        type="button"
        role="tab"
        class={segmentClass}
        data-install-mode="json"
        aria-selected="false"
      >
        配置 JSON
      </button>
    </div>

    <div class="mt-4" data-install-content="prompt">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <label class="flex items-center gap-2 text-[12.5px] text-bone-soft">
          AI 客户端
          <select class={selectClass} data-install-client>
            {MCP_INSTALL_TARGETS.map((target) => (
              <option key={target.value} value={target.value}>
                {target.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          class={buttonClass("primary", "sm")}
          data-copy-install
        >
          复制提示词
        </button>
      </div>
      <p class="mb-3 text-[12.5px] leading-relaxed text-status-pending">
        提示词包含当前令牌，只粘贴给你信任的本机 AI 客户端。
      </p>
      {MCP_INSTALL_TARGETS.map((target) => (
        <div
          key={target.value}
          data-install-target={target.value}
          hidden={target.value !== "codex"}
        >
          <textarea class={outputClass} readOnly spellcheck={false}>
            {buildMcpInstallPrompt({
              target: target.value,
              endpointUrl,
              tokenValue,
            })}
          </textarea>
        </div>
      ))}
    </div>

    <div class="mt-4" data-install-content="json" hidden>
      <div class="mb-3 flex justify-end">
        <button
          type="button"
          class={buttonClass("primary", "sm")}
          data-copy-install
        >
          复制 JSON
        </button>
      </div>
      <textarea class={outputClass} readOnly spellcheck={false}>
        {buildMcpConfigSnippet(endpointUrl, tokenValue)}
      </textarea>
    </div>

    <script dangerouslySetInnerHTML={{ __html: installPanelScript }} />
  </div>
);
