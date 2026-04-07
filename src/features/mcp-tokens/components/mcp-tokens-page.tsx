import { PageShell } from "@/features/layout/components/page-shell";
import type { McpTokenSummary } from "@/features/mcp-tokens/model/types";

const formatDate = (value: string | null): string => {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
};

const maskTokenValue = (tokenValue: string): string => {
  if (tokenValue.length <= 18) {
    return tokenValue;
  }

  return `${tokenValue.slice(0, 12)}...${tokenValue.slice(-8)}`;
};

const buildConfigSnippet = (
  endpointUrl: string,
  tokenValue: string
): string => {
  return JSON.stringify(
    {
      mcpServers: {
        cloudmind: {
          url: endpointUrl,
          headers: {
            Authorization: `Bearer ${tokenValue}`,
          },
        },
      },
    },
    null,
    2
  );
};

const ActiveStatusBadge = ({ revokedAt }: { revokedAt: string | null }) => {
  if (revokedAt) {
    return (
      <span class="inline-flex items-center rounded-full bg-[#f9e3e3] px-2.5 py-1 text-[12px] font-medium text-[#9c2e2e]">
        Revoked
      </span>
    );
  }

  return (
    <span class="inline-flex items-center rounded-full bg-[#e3f2e8] px-2.5 py-1 text-[12px] font-medium text-[#2e6c3e]">
      Active
    </span>
  );
};

// 这里提供最小 MCP token 管理页，先让单用户部署具备可见的 token 运维入口。
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
      title="MCP Tokens"
      subtitle="Create and manage bearer tokens for remote MCP clients. This MVP stores token values so they can be viewed again from the dashboard."
      navigationKey="mcp"
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

      <section class="mb-5 grid grid-cols-[minmax(0,0.95fr)_minmax(320px,0.65fr)] gap-4">
        <article class="rounded-lg border border-[#e8e8e7] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 class="mt-0 text-[20px] font-semibold text-[#37352f]">
            Connection details
          </h2>
          <div class="mt-4 grid gap-3">
            <div>
              <p class="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9b9a97]">
                Server URL
              </p>
              <code class="block rounded-md border border-[#e8e8e7] bg-[#fafaf9] px-3 py-2 text-[13px] text-[#37352f] break-all">
                {endpointUrl}
              </code>
            </div>

            <div>
              <p class="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9b9a97]">
                Auth Header
              </p>
              <code class="block rounded-md border border-[#e8e8e7] bg-[#fafaf9] px-3 py-2 text-[13px] text-[#37352f] break-all">
                Authorization: Bearer &lt;token&gt;
              </code>
            </div>

            <p class="mb-0 text-[14px] leading-relaxed text-[#787774]">
              Any valid token can call <code>/mcp</code>. This version only
              checks token validity and does not split read/write permissions.
            </p>

            <p class="mb-0 text-[13px] leading-relaxed text-[#9c6b16]">
              The dashboard page itself is not protected by in-app login yet. If
              this deployment is public, put the admin UI behind Cloudflare
              Access or another external gate.
            </p>
          </div>
        </article>

        <article class="rounded-lg border border-[#e8e8e7] bg-white p-5">
          <h2 class="mt-0 text-[20px] font-semibold text-[#37352f]">
            Create token
          </h2>
          <p class="mb-4 text-[14px] leading-relaxed text-[#787774]">
            Give each client a clear name such as Claude Desktop, Cursor, or
            local test agent.
          </p>

          <form
            action="/mcp-tokens/actions/create"
            method="post"
            class="grid gap-4"
          >
            <label class="grid gap-2">
              <span class="text-[14px] font-semibold text-[#37352f]">
                Token name
              </span>
              <input
                name="name"
                type="text"
                placeholder="Claude Desktop"
                class="rounded-md border border-[#e8e8e7] bg-white px-3 py-2 text-[14px] text-[#37352f] focus:border-[#37352f] focus:outline-none"
              />
            </label>

            <button
              type="submit"
              class="w-fit cursor-pointer rounded-md bg-[#37352f] px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-[#2f2d28]"
            >
              Generate token
            </button>
          </form>
        </article>
      </section>

      <section class="grid gap-4">
        {items.length === 0 ? (
          <article class="rounded-lg border border-dashed border-[#d6d5d2] bg-white px-5 py-8 text-center">
            <h2 class="mt-0 text-[20px] font-semibold text-[#37352f]">
              No tokens yet
            </h2>
            <p class="mb-0 text-[14px] text-[#787774]">
              Create your first MCP token to enable remote clients to connect.
            </p>
          </article>
        ) : null}

        {items.map((item) => (
          <article
            key={item.id}
            class="rounded-lg border border-[#e8e8e7] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="m-0 text-[18px] font-semibold text-[#37352f]">
                    {item.name}
                  </h2>
                  <ActiveStatusBadge revokedAt={item.revokedAt} />
                </div>
                <p class="mt-2 mb-0 text-[14px] text-[#787774]">
                  Created {formatDate(item.createdAt)} · Last used{" "}
                  {formatDate(item.lastUsedAt)}
                </p>
                {item.revokedAt ? (
                  <p class="mt-1 mb-0 text-[13px] text-[#9c2e2e]">
                    Revoked at {formatDate(item.revokedAt)}
                  </p>
                ) : null}
              </div>

              {!item.revokedAt ? (
                <form
                  action={`/mcp-tokens/actions/${item.id}/revoke`}
                  method="post"
                >
                  <button
                    type="submit"
                    class="cursor-pointer rounded-md border border-[#e8b7b7] bg-white px-3 py-2 text-[13px] font-semibold text-[#9c2e2e] transition-colors hover:bg-[#fff5f5]"
                  >
                    Revoke token
                  </button>
                </form>
              ) : null}
            </div>

            <div class="mt-4 rounded-md border border-[#e8e8e7] bg-[#fafaf9] px-4 py-3">
              <p class="mt-0 mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9b9a97]">
                Token Preview
              </p>
              <code class="block text-[13px] text-[#37352f] break-all">
                {maskTokenValue(item.tokenValue)}
              </code>
            </div>

            <details class="mt-4 rounded-md border border-[#e8e8e7] bg-white">
              <summary class="cursor-pointer list-none px-4 py-3 text-[14px] font-semibold text-[#37352f]">
                View full token
              </summary>
              <div class="border-t border-[#e8e8e7] px-4 py-3">
                <code class="block text-[13px] text-[#37352f] break-all">
                  {item.tokenValue}
                </code>
              </div>
            </details>

            <details class="mt-3 rounded-md border border-[#e8e8e7] bg-white">
              <summary class="cursor-pointer list-none px-4 py-3 text-[14px] font-semibold text-[#37352f]">
                View config snippet
              </summary>
              <div class="border-t border-[#e8e8e7] px-4 py-3">
                <pre class="m-0 overflow-x-auto rounded-md bg-[#fafaf9] p-3 text-[12px] leading-relaxed text-[#37352f]">
                  <code>
                    {buildConfigSnippet(endpointUrl, item.tokenValue)}
                  </code>
                </pre>
              </div>
            </details>
          </article>
        ))}
      </section>
    </PageShell>
  );
};
