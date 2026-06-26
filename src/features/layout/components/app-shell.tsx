import type { Child } from "hono/jsx";

// 导航键：覆盖三区全部入口（部分页面 Phase 1 后续阶段才落地，先占位路由）。
export type NavigationKey =
  | "overview"
  | "library"
  | "capture"
  | "ask"
  | "graph"
  | "timeline"
  | "consolidation"
  | "activity"
  | "mcp"
  | "settings"
  | "search";

interface NavItem {
  key: NavigationKey;
  label: string;
  href: string;
  glyph: string;
}

// 三区导航：工作区（日常）/ 记忆层（L2-L3 差异化）/ 系统。
const navSections: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "工作区",
    items: [
      { key: "overview", label: "纵览", href: "/", glyph: "#" },
      { key: "library", label: "记忆库", href: "/assets", glyph: "▤" },
      { key: "capture", label: "采集", href: "/capture", glyph: "+" },
      { key: "ask", label: "问答", href: "/ask", glyph: "?" },
    ],
  },
  {
    label: "记忆层",
    items: [
      { key: "graph", label: "记忆图谱", href: "/memory/graph", glyph: "◆" },
      {
        key: "timeline",
        label: "事实 / 时间线",
        href: "/memory/timeline",
        glyph: "≡",
      },
      {
        key: "consolidation",
        label: "整合",
        href: "/memory/consolidation",
        glyph: "◍",
      },
    ],
  },
  {
    label: "系统",
    items: [
      { key: "search", label: "搜索", href: "/search", glyph: "⌕" },
      { key: "activity", label: "活动 / 任务", href: "/activity", glyph: "›_" },
      { key: "mcp", label: "MCP 令牌", href: "/mcp-tokens", glyph: "⚿" },
      { key: "settings", label: "设置", href: "/change-password", glyph: "=" },
    ],
  },
];

const NavLink = ({ item, active }: { item: NavItem; active: boolean }) => (
  <a
    href={item.href}
    class={`relative flex items-center gap-3 rounded-md px-2.5 py-2 text-[14px] font-medium no-underline transition-all duration-150 ease-glass ${
      active
        ? "bg-brass-soft text-bone before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-sm before:bg-brass"
        : "text-bone-soft hover:bg-[rgba(236,228,212,0.04)] hover:text-bone"
    }`}
  >
    <span class="w-[15px] text-center font-mono text-[12px] opacity-85">
      {item.glyph}
    </span>
    {item.label}
  </a>
);

// Observatory 工作台外壳：深墨底、黄铜金高亮、Fraunces 品牌、三区导航 + 系统脚注。
export const AppShell = ({
  children,
  navigationKey,
}: {
  children: Child;
  navigationKey: NavigationKey;
}) => {
  return (
    <div class="min-h-screen">
      {/* --- 移动端顶栏（桌面隐藏） --- */}
      <header class="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-ink/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <span class="font-display text-[17px] font-semibold text-bone">
          CloudMind<span class="text-brass">.</span>
        </span>
        <details class="relative">
          <summary class="cursor-pointer list-none rounded-md border border-line bg-ink-raised px-3 py-1.5 text-[14px] font-medium text-bone-soft transition-colors hover:text-bone">
            菜单
          </summary>
          <nav class="absolute right-0 z-50 mt-2 w-[min(300px,calc(100vw-32px))] rounded-lg border border-line bg-ink-panel p-3 shadow-[0_18px_50px_rgba(0,0,0,0.5)]">
            {navSections.map((section) => (
              <div key={section.label} class="mb-2 last:mb-0">
                <p class="px-2.5 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-bone-faint">
                  {section.label}
                </p>
                {section.items.map((item) => (
                  <NavLink
                    key={item.key}
                    item={item}
                    active={item.key === navigationKey}
                  />
                ))}
              </div>
            ))}
            <a
              href="/auth/logout"
              class="mt-2 block border-t border-line-soft px-2.5 pt-3 text-[13px] text-bone-faint no-underline transition-colors hover:text-bone"
            >
              退出登录
            </a>
          </nav>
        </details>
      </header>

      {/* --- 桌面双栏（侧栏 + 主区） --- */}
      <div class="lg:grid lg:min-h-screen lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* --- 侧栏（桌面） --- */}
        <aside class="sticky top-0 hidden h-screen overflow-auto border-r border-line bg-gradient-to-b from-[rgba(18,21,28,0.4)] to-transparent lg:block">
          <div class="flex h-full flex-col px-5 py-7">
            {/* 品牌 */}
            <div class="border-b border-line-soft px-2 pb-4">
              <p class="font-display text-[23px] font-semibold leading-none tracking-tight text-bone">
                CloudMind<span class="text-brass">.</span>
              </p>
              <p class="mt-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-faint">
                Self-hosted memory layer
              </p>
            </div>

            {/* 三区导航 */}
            {navSections.map((section) => (
              <nav key={section.label} class="mt-6">
                <p class="mb-2 px-2 font-mono text-[10px] uppercase tracking-[0.22em] text-bone-faint">
                  {section.label}
                </p>
                <div class="flex flex-col gap-0.5">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.key}
                      item={item}
                      active={item.key === navigationKey}
                    />
                  ))}
                </div>
              </nav>
            ))}

            {/* 系统脚注 */}
            <div class="mt-auto border-t border-line-soft px-2 pt-4 font-mono text-[11px] leading-[1.9] text-bone-faint">
              <div class="flex justify-between">
                <span>mode</span>
                <span class="text-bone-soft">single-user</span>
              </div>
              <div class="flex justify-between">
                <span>store</span>
                <span class="text-bone-soft">D1·R2·Vectorize</span>
              </div>
              <div class="flex justify-between">
                <span>scope</span>
                <span class="text-bone-soft">personal</span>
              </div>
            </div>
          </div>
        </aside>

        {/* --- 主内容区 --- */}
        <div class="min-w-0 px-5 py-7 pb-12 lg:px-10 lg:py-9">{children}</div>
      </div>
    </div>
  );
};
