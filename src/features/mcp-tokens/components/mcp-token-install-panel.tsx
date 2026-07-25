import {
  buildMcpConfigSnippet,
  buildMcpInstallPrompt,
} from "@/features/mcp-tokens/model/install-instructions";
import { buttonClass } from "@/features/ui/components";

const segmentClass =
  "rounded-md px-3 py-1.5 text-[13px] font-medium text-bone-soft transition-colors hover:text-bone aria-selected:bg-brass aria-selected:text-on-brass";

const outputClass =
  "h-80 w-full resize-y rounded-md border border-line bg-ink px-3 py-3 font-mono text-[12px] leading-relaxed text-bone-soft outline-none focus:border-brass";

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
      <div class="mb-3 flex justify-end">
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
      <textarea class={outputClass} readOnly spellcheck={false}>
        {buildMcpInstallPrompt({ endpointUrl, tokenValue })}
      </textarea>
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
  </div>
);
