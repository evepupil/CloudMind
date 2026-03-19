import type { Child } from "hono/jsx";

export type NavigationKey =
  | "overview"
  | "library"
  | "capture"
  | "ask"
  | "search";

const navigationItems: Array<{
  key: NavigationKey;
  label: string;
  href: string;
  description: string;
}> = [
  {
    key: "overview",
    label: "Overview",
    href: "/",
    description: "Knowledge pulse",
  },
  {
    key: "library",
    label: "Library",
    href: "/assets",
    description: "Browse assets",
  },
  {
    key: "capture",
    label: "Capture",
    href: "/capture",
    description: "Save new knowledge",
  },
  {
    key: "ask",
    label: "Ask",
    href: "/ask",
    description: "Question your library",
  },
  {
    key: "search",
    label: "Search",
    href: "/search",
    description: "Find by query",
  },
];

const quickLinks = [
  {
    label: "Save URL",
    href: "/capture?mode=url",
  },
  {
    label: "Paste Text",
    href: "/capture?mode=text",
  },
  {
    label: "Upload PDF",
    href: "/capture?mode=pdf",
  },
];

// 这里构建全局工作台外壳，统一承载侧边栏、移动端入口和主内容区。
export const AppShell = ({
  children,
  navigationKey,
}: {
  children: Child;
  navigationKey: NavigationKey;
}) => {
  return (
    <div class="cm-shell">
      <style>{`
        :root {
          color-scheme: light;
        }

        body {
          margin: 0;
          background:
            radial-gradient(circle at top left, rgba(186, 230, 253, 0.38), transparent 28%),
            radial-gradient(circle at top right, rgba(165, 243, 252, 0.25), transparent 24%),
            linear-gradient(180deg, #f6f7f3 0%, #edf2f7 100%);
          color: #102033;
          font-family:
            "Segoe UI Variable Text",
            "Segoe UI",
            "Helvetica Neue",
            Arial,
            sans-serif;
        }

        a {
          color: inherit;
        }

        .cm-shell {
          min-height: 100vh;
        }

        .cm-mobile-bar {
          display: none;
          position: sticky;
          top: 0;
          z-index: 20;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 18px;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(247, 248, 244, 0.92);
          backdrop-filter: blur(14px);
        }

        .cm-mobile-brand {
          display: grid;
          gap: 2px;
        }

        .cm-mobile-title {
          margin: 0;
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #1d4ed8;
          font-weight: 800;
        }

        .cm-mobile-subtitle {
          margin: 0;
          font-size: 13px;
          color: #526071;
        }

        .cm-mobile-details {
          position: relative;
        }

        .cm-mobile-summary {
          list-style: none;
          cursor: pointer;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: #ffffff;
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 14px;
          font-weight: 700;
          color: #102033;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }

        .cm-mobile-summary::-webkit-details-marker {
          display: none;
        }

        .cm-mobile-panel {
          position: absolute;
          right: 0;
          margin-top: 12px;
          width: min(320px, calc(100vw - 36px));
          padding: 14px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.16);
        }

        .cm-layout {
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          min-height: 100vh;
        }

        .cm-sidebar {
          position: sticky;
          top: 0;
          align-self: start;
          display: grid;
          grid-template-rows: auto auto 1fr auto;
          gap: 28px;
          height: 100vh;
          padding: 28px 22px;
          background:
            linear-gradient(180deg, rgba(10, 18, 31, 0.94) 0%, rgba(15, 23, 42, 0.98) 100%);
          color: #e6edf5;
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          box-sizing: border-box;
        }

        .cm-brand {
          display: grid;
          gap: 8px;
        }

        .cm-brand-mark {
          width: 44px;
          height: 44px;
          display: inline-grid;
          place-items: center;
          border-radius: 14px;
          background:
            linear-gradient(135deg, rgba(125, 211, 252, 0.26), rgba(94, 234, 212, 0.24));
          color: #ecfeff;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
        }

        .cm-brand-eyebrow {
          margin: 0;
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #7dd3fc;
          font-weight: 800;
        }

        .cm-brand-title {
          margin: 0;
          font-size: 24px;
          line-height: 1.05;
          color: #f8fbff;
          font-family:
            "Georgia",
            "Palatino Linotype",
            serif;
        }

        .cm-brand-copy {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: rgba(226, 232, 240, 0.72);
        }

        .cm-sidebar-section-title {
          margin: 0 0 12px;
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(186, 230, 253, 0.74);
          font-weight: 800;
        }

        .cm-nav-list,
        .cm-quick-list {
          display: grid;
          gap: 8px;
        }

        .cm-nav-item {
          display: grid;
          gap: 3px;
          padding: 12px 14px;
          border-radius: 16px;
          text-decoration: none;
          color: rgba(241, 245, 249, 0.88);
          background: transparent;
          border: 1px solid transparent;
          transition:
            background-color 120ms ease,
            border-color 120ms ease,
            transform 120ms ease;
        }

        .cm-nav-item:hover {
          transform: translateX(1px);
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .cm-nav-item[data-active="true"] {
          background:
            linear-gradient(135deg, rgba(125, 211, 252, 0.18), rgba(94, 234, 212, 0.12));
          border-color: rgba(103, 232, 249, 0.24);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .cm-nav-label {
          font-size: 15px;
          font-weight: 700;
          color: inherit;
        }

        .cm-nav-copy {
          font-size: 12px;
          color: rgba(226, 232, 240, 0.64);
        }

        .cm-quick-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 11px 14px;
          border-radius: 14px;
          text-decoration: none;
          color: rgba(241, 245, 249, 0.84);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .cm-quick-link span:last-child {
          color: rgba(125, 211, 252, 0.88);
          font-weight: 700;
        }

        .cm-sidebar-footer {
          display: grid;
          gap: 12px;
          padding: 16px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .cm-footer-line {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 13px;
          color: rgba(226, 232, 240, 0.74);
        }

        .cm-main {
          min-width: 0;
          padding: 30px 34px 40px;
          box-sizing: border-box;
        }

        @media (max-width: 960px) {
          .cm-mobile-bar {
            display: flex;
          }

          .cm-layout {
            display: block;
            min-height: auto;
          }

          .cm-sidebar {
            display: none;
          }

          .cm-main {
            padding: 20px 16px 32px;
          }
        }
      `}</style>

      <header class="cm-mobile-bar">
        <div class="cm-mobile-brand">
          <p class="cm-mobile-title">CloudMind</p>
          <p class="cm-mobile-subtitle">Personal knowledge workspace</p>
        </div>
        <details class="cm-mobile-details">
          <summary class="cm-mobile-summary">Menu</summary>
          <nav class="cm-mobile-panel">
            <div class="cm-nav-list">
              {navigationItems.map((item) => (
                <a
                  key={item.key}
                  class="cm-nav-item"
                  data-active={item.key === navigationKey}
                  href={item.href}
                >
                  <span class="cm-nav-label">{item.label}</span>
                  <span class="cm-nav-copy">{item.description}</span>
                </a>
              ))}
            </div>
          </nav>
        </details>
      </header>

      <div class="cm-layout">
        <aside class="cm-sidebar">
          <div class="cm-brand">
            <span class="cm-brand-mark">CM</span>
            <div>
              <p class="cm-brand-eyebrow">Knowledge Workspace</p>
              <h1 class="cm-brand-title">CloudMind</h1>
            </div>
            <p class="cm-brand-copy">
              Build a private archive for webpages, notes, PDFs, and future AI
              conversations.
            </p>
          </div>

          <section>
            <p class="cm-sidebar-section-title">Navigate</p>
            <nav class="cm-nav-list">
              {navigationItems.map((item) => (
                <a
                  key={item.key}
                  class="cm-nav-item"
                  data-active={item.key === navigationKey}
                  href={item.href}
                >
                  <span class="cm-nav-label">{item.label}</span>
                  <span class="cm-nav-copy">{item.description}</span>
                </a>
              ))}
            </nav>
          </section>

          <section>
            <p class="cm-sidebar-section-title">Quick Actions</p>
            <div class="cm-quick-list">
              {quickLinks.map((item) => (
                <a key={item.label} class="cm-quick-link" href={item.href}>
                  <span>{item.label}</span>
                  <span>Open</span>
                </a>
              ))}
            </div>
          </section>

          <section class="cm-sidebar-footer">
            <p class="cm-sidebar-section-title" style={{ margin: 0 }}>
              Workspace Pulse
            </p>
            <div class="cm-footer-line">
              <span>Mode</span>
              <span>Single user</span>
            </div>
            <div class="cm-footer-line">
              <span>Storage</span>
              <span>D1 + R2</span>
            </div>
            <div class="cm-footer-line">
              <span>Focus</span>
              <span>MVP prototype</span>
            </div>
          </section>
        </aside>

        <div class="cm-main">{children}</div>
      </div>
    </div>
  );
};
