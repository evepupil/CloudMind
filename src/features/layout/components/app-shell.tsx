import type { Child } from "hono/jsx";

export type NavigationKey =
  | "overview"
  | "library"
  | "capture"
  | "ask"
  | "mcp"
  | "search";

const navigationItems: Array<{
  key: NavigationKey;
  label: string;
  href: string;
}> = [
  { key: "overview", label: "Overview", href: "/" },
  { key: "library", label: "Library", href: "/assets" },
  { key: "capture", label: "Capture", href: "/capture" },
  { key: "ask", label: "Ask", href: "/ask" },
  { key: "mcp", label: "MCP", href: "/mcp-tokens" },
  { key: "search", label: "Search", href: "/search" },
];

const quickActions = [
  { label: "Save URL", href: "/capture?mode=url" },
  { label: "Paste text", href: "/capture?mode=text" },
  { label: "Upload PDF", href: "/capture?mode=pdf" },
];

// 这里统一定义 Notion 风格工作台外壳：白色窄 sidebar + 米色主内容区。
export const AppShell = ({
  children,
  navigationKey,
}: {
  children: Child;
  navigationKey: NavigationKey;
}) => {
  return (
    <div class="min-h-screen bg-[#f7f6f3]">
      {/* --- Mobile header bar (hidden on desktop) --- */}
      <header class="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 border-b border-[#e8e8e7] bg-white/92 backdrop-blur-sm">
        <span class="text-[14px] font-semibold text-[#37352f]">CloudMind</span>
        <details class="relative">
          <summary
            class="list-none cursor-pointer px-3 py-1.5 rounded-md border border-[#e8e8e7] bg-white text-[14px] font-medium text-[#37352f] hover:bg-[#f1f1f0] transition-colors"
            style="box-shadow: 0 1px 2px rgba(0,0,0,0.04)"
          >
            Menu
          </summary>
          <nav class="absolute right-0 mt-2 w-[min(300px,calc(100vw-32px))] p-3 rounded-lg border border-[#e8e8e7] bg-white z-50">
            {navigationItems.map((item) => (
              <a
                key={item.key}
                class={`block px-3 py-2 rounded-md text-[14px] no-underline transition-colors ${
                  item.key === navigationKey
                    ? "bg-[#ebebea] text-[#37352f] font-medium"
                    : "text-[#37352f] hover:bg-[#f1f1f0]"
                }`}
                href={item.href}
              >
                {item.label}
              </a>
            ))}
            <div class="mt-2 pt-2 border-t border-[#ededec]">
              {quickActions.map((action) => (
                <a
                  key={action.label}
                  class="block px-3 py-1.5 rounded-md text-[13px] text-[#787774] no-underline hover:bg-[#f1f1f0] transition-colors"
                  href={action.href}
                >
                  {action.label}
                </a>
              ))}
            </div>
          </nav>
        </details>
      </header>

      {/* --- Two-column layout (sidebar + main) --- */}
      <div class="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:min-h-screen">
        {/* --- Sidebar (desktop) --- */}
        <aside class="hidden lg:block sticky top-0 h-screen overflow-auto bg-white border-r border-[#e8e8e7]">
          <div class="flex flex-col h-full px-3 py-5">
            {/* Brand */}
            <div class="px-3 pb-4 mb-2 border-b border-[#ededec]">
              <p class="text-[14px] font-semibold text-[#37352f] leading-tight">
                CloudMind
              </p>
              <p class="mt-1 text-[12px] text-[#9b9a97]">
                Personal knowledge layer
              </p>
            </div>

            {/* Navigation */}
            <nav class="flex flex-col gap-0.5 mt-1">
              {navigationItems.map((item) => (
                <a
                  key={item.key}
                  class={`block px-3 py-1.5 rounded-md text-[14px] no-underline transition-colors ${
                    item.key === navigationKey
                      ? "bg-[#ebebea] text-[#37352f] font-medium"
                      : "text-[#37352f] hover:bg-[#f1f1f0]"
                  }`}
                  href={item.href}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            {/* Quick actions */}
            <div class="mt-6">
              <p class="px-3 mb-2 text-[11px] text-[#9b9a97] font-semibold uppercase tracking-wider">
                Quick actions
              </p>
              <div class="flex flex-col gap-0.5">
                {quickActions.map((action) => (
                  <a
                    key={action.label}
                    class="block px-3 py-1.5 rounded-md text-[13px] text-[#787774] no-underline hover:bg-[#f1f1f0] transition-colors"
                    href={action.href}
                  >
                    {action.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Workspace info (footer) */}
            <div class="mt-auto pt-4 border-t border-[#ededec]">
              <div class="flex justify-between px-3 py-1 text-[12px]">
                <span class="text-[#9b9a97]">Mode</span>
                <span class="text-[#787774]">Single-user MVP</span>
              </div>
              <div class="flex justify-between px-3 py-1 text-[12px]">
                <span class="text-[#9b9a97]">Storage</span>
                <span class="text-[#787774]">D1 / R2 / Vectorize</span>
              </div>
            </div>
          </div>
        </aside>

        {/* --- Main content area --- */}
        <div class="min-w-0 p-7 pb-10 lg:px-8 lg:py-7 lg:pb-10">{children}</div>
      </div>
    </div>
  );
};
