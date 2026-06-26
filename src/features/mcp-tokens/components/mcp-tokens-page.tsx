import { PageShell } from "@/features/layout/components/page-shell";
import type { McpTokenSummary } from "@/features/mcp-tokens/model/types";
import {
  buttonClass,
  EmptyState,
  FlashMessage,
  Panel,
  StatusBadge,
} from "@/features/ui/components";

const formatDate = (value: string | null): string => {
  if (!value) {
    return "从未";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
};

const maskTokenValue = (tokenValue: string): string => {
  if (tokenValue.length <= 18) {
    return tokenValue;
  }
  return `${tokenValue.slice(0, 12)}...${tokenValue.slice(-8)}`;
};

const buildConfigSnippet = (endpointUrl: string, tokenValue: string): string =>
  JSON.stringify(
    {
      mcpServers: {
        cloudmind: {
          url: endpointUrl,
          headers: { Authorization: `Bearer ${tokenValue}` },
        },
      },
    },
    null,
    2
  );

const codeBlockClass =
  "block break-all rounded-md border border-line bg-ink-raised px-3 py-2 font-mono text-[13px] text-bone";

// MCP 令牌管理：连接信息 + 创建 + 令牌列表（预览/全文/配置片段）。
export const McpTokensPage = ({
  items,
  endpointUrl,
  errorMessage,
  flashMessage,
}: {
  items: McpTokenSummary[];
  endpointUrl: string;
  errorMessage?: string | undefined;
  flashMessage?: string | undefined;
}) => {
  return (
    <PageShell
      navigationKey="mcp"
      eyebrow="系统 · MCP"
      title="MCP 令牌"
      subtitle="为远程 MCP 客户端创建与管理 bearer 令牌。本 MVP 保存令牌值以便从后台再次查看。"
    >
      {flashMessage ? (
        <FlashMessage kind="success" class="mb-4">
          {flashMessage}
        </FlashMessage>
      ) : null}
      {errorMessage ? (
        <FlashMessage kind="error" class="mb-4">
          {errorMessage}
        </FlashMessage>
      ) : null}

      <section class="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.65fr)]">
        <Panel class="p-5" variant="panel">
          <h2 class="font-display text-[19px] font-semibold text-bone">
            连接信息
          </h2>
          <div class="mt-4 grid gap-3">
            <div>
              <p class="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-bone-faint">
                Server URL
              </p>
              <code class={codeBlockClass}>{endpointUrl}</code>
            </div>
            <div>
              <p class="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-bone-faint">
                Auth Header
              </p>
              <code class={codeBlockClass}>
                Authorization: Bearer &lt;token&gt;
              </code>
            </div>
            <p class="text-[13.5px] leading-relaxed text-bone-soft">
              任何有效令牌都能调用 <code class="text-brass">/mcp</code>
              。本版本只 校验令牌有效性，不区分读写权限。
            </p>
            <p class="text-[12.5px] leading-relaxed text-status-pending">
              后台页本身尚未由应用内登录保护。若此部署公开，请把管理 UI 放在
              Cloudflare Access 或其他外部门禁之后。
            </p>
          </div>
        </Panel>

        <Panel class="p-5" variant="panel">
          <h2 class="font-display text-[19px] font-semibold text-bone">
            创建令牌
          </h2>
          <p class="mb-4 mt-1.5 text-[13.5px] leading-relaxed text-bone-soft">
            给每个客户端起个清晰的名字，如 Claude Desktop、Cursor 或本地测试
            agent。
          </p>
          <form
            action="/mcp-tokens/actions/create"
            method="post"
            class="grid gap-4"
          >
            <label class="grid gap-1.5">
              <span class="text-[12px] font-medium text-bone-soft">
                令牌名称
              </span>
              <input
                name="name"
                type="text"
                placeholder="Claude Desktop"
                class="w-full rounded-md border border-line bg-ink-raised px-3 py-2 text-[14px] text-bone outline-none transition-colors placeholder:text-bone-faint focus:border-brass"
              />
            </label>
            <button type="submit" class={`w-fit ${buttonClass("primary")}`}>
              生成令牌
            </button>
          </form>
        </Panel>
      </section>

      <section class="grid gap-4">
        {items.length === 0 ? (
          <EmptyState
            title="还没有令牌"
            description="创建第一个 MCP 令牌，让远程客户端可以连接。"
          />
        ) : null}

        {items.map((item) => (
          <Panel key={item.id} class="p-5" variant="panel">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="font-display text-[17px] font-semibold text-bone">
                    {item.name}
                  </h2>
                  <StatusBadge
                    status={item.revokedAt ? "failed" : "ready"}
                    label={item.revokedAt ? "已吊销" : "活跃"}
                  />
                </div>
                <p class="mt-2 font-mono text-[12px] text-bone-faint">
                  创建 {formatDate(item.createdAt)} · 最近使用{" "}
                  {formatDate(item.lastUsedAt)}
                </p>
                {item.revokedAt ? (
                  <p class="mt-1 font-mono text-[12px] text-status-failed">
                    吊销于 {formatDate(item.revokedAt)}
                  </p>
                ) : null}
              </div>
              {!item.revokedAt ? (
                <form
                  action={`/mcp-tokens/actions/${item.id}/revoke`}
                  method="post"
                >
                  <button type="submit" class={buttonClass("danger", "sm")}>
                    吊销令牌
                  </button>
                </form>
              ) : null}
            </div>

            <div class="mt-4 rounded-md border border-line bg-ink-raised px-4 py-3">
              <p class="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-bone-faint">
                令牌预览
              </p>
              <code class="block break-all font-mono text-[13px] text-bone">
                {maskTokenValue(item.tokenValue)}
              </code>
            </div>

            <details class="mt-3 rounded-md border border-line bg-ink-raised">
              <summary class="cursor-pointer list-none px-4 py-3 text-[13.5px] font-medium text-bone">
                查看完整令牌
              </summary>
              <div class="border-t border-line px-4 py-3">
                <code class="block break-all font-mono text-[13px] text-bone-soft">
                  {item.tokenValue}
                </code>
              </div>
            </details>

            <details class="mt-2.5 rounded-md border border-line bg-ink-raised">
              <summary class="cursor-pointer list-none px-4 py-3 text-[13.5px] font-medium text-bone">
                查看配置片段
              </summary>
              <div class="border-t border-line px-4 py-3">
                <pre class="m-0 overflow-x-auto font-mono text-[12px] leading-relaxed text-bone-soft">
                  <code>
                    {buildConfigSnippet(endpointUrl, item.tokenValue)}
                  </code>
                </pre>
              </div>
            </details>
          </Panel>
        ))}
      </section>
    </PageShell>
  );
};
