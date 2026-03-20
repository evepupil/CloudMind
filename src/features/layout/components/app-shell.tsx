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
    description: "Workspace status",
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
    description: "Ingest sources",
  },
  {
    key: "ask",
    label: "Ask",
    href: "/ask",
    description: "Grounded answers",
  },
  {
    key: "search",
    label: "Search",
    href: "/search",
    description: "Semantic retrieval",
  },
];

const quickActions = [
  {
    label: "Save URL",
    value: "Web source",
    href: "/capture?mode=url",
  },
  {
    label: "Paste text",
    value: "Manual note",
    href: "/capture?mode=text",
  },
  {
    label: "Upload PDF",
    value: "Document",
    href: "/capture?mode=pdf",
  },
];

const workspaceSignals = [
  {
    label: "Mode",
    value: "Single-user MVP",
  },
  {
    label: "Storage",
    value: "D1 / R2 / Vectorize",
  },
  {
    label: "Style",
    value: "Calm operator UI",
  },
];

// 这里统一定义工作台外壳，先把 Cloudflare-ish 的秩序感落在侧边栏和整体版式上。
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
          --cm-bg: #f5f3ee;
          --cm-bg-soft: #fbfaf7;
          --cm-bg-panel: #fffdf9;
          --cm-bg-panel-strong: #ffffff;
          --cm-ink: #16202d;
          --cm-ink-soft: #566375;
          --cm-line: rgba(21, 33, 51, 0.1);
          --cm-line-strong: rgba(21, 33, 51, 0.16);
          --cm-shadow: 0 24px 60px rgba(28, 39, 56, 0.09);
          --cm-orange: #f48120;
          --cm-orange-soft: #fff1dd;
          --cm-orange-line: rgba(244, 129, 32, 0.26);
          --cm-blue: #0f1726;
          --cm-blue-soft: #1b2638;
          --cm-cyan: #5eb6ff;
          --cm-radius-lg: 28px;
          --cm-radius-md: 20px;
          --cm-radius-sm: 14px;
          --cm-sidebar-width: 304px;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background:
            radial-gradient(circle at top left, rgba(244, 129, 32, 0.12), transparent 24%),
            radial-gradient(circle at top right, rgba(94, 182, 255, 0.14), transparent 26%),
            linear-gradient(180deg, #f7f4ef 0%, #f1eee8 100%);
          color: var(--cm-ink);
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

        .cm-layout {
          display: grid;
          grid-template-columns: var(--cm-sidebar-width) minmax(0, 1fr);
          min-height: 100vh;
        }

        .cm-sidebar {
          position: sticky;
          top: 0;
          align-self: start;
          height: 100vh;
          padding: 22px;
          background:
            radial-gradient(circle at top right, rgba(244, 129, 32, 0.18), transparent 24%),
            linear-gradient(180deg, #111826 0%, #162131 52%, #111a27 100%);
          color: #f4f7fb;
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          overflow: auto;
        }

        .cm-sidebar-inner {
          display: grid;
          grid-template-rows: auto auto 1fr auto;
          gap: 18px;
          min-height: 100%;
        }

        .cm-mobile-bar {
          display: none;
          position: sticky;
          top: 0;
          z-index: 30;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--cm-line);
          background: rgba(250, 248, 244, 0.92);
          backdrop-filter: blur(14px);
        }

        .cm-mobile-brand {
          display: grid;
          gap: 3px;
        }

        .cm-mobile-kicker {
          margin: 0;
          color: var(--cm-orange);
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-weight: 800;
        }

        .cm-mobile-title {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: var(--cm-ink);
        }

        .cm-mobile-details {
          position: relative;
        }

        .cm-mobile-summary {
          list-style: none;
          cursor: pointer;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid var(--cm-line);
          background: rgba(255, 255, 255, 0.86);
          color: var(--cm-ink);
          font-size: 14px;
          font-weight: 700;
          box-shadow: 0 8px 24px rgba(22, 32, 45, 0.08);
        }

        .cm-mobile-summary::-webkit-details-marker {
          display: none;
        }

        .cm-mobile-panel {
          position: absolute;
          right: 0;
          margin-top: 10px;
          width: min(340px, calc(100vw - 32px));
          padding: 14px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.98);
          border: 1px solid var(--cm-line);
          box-shadow: var(--cm-shadow);
        }

        .cm-brand-panel,
        .cm-section-panel,
        .cm-signal-panel {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          border-radius: 22px;
        }

        .cm-brand-panel {
          padding: 18px;
          display: grid;
          gap: 14px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.03));
        }

        .cm-brand-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .cm-brand-mark {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border-radius: 16px;
          background:
            linear-gradient(135deg, rgba(244, 129, 32, 0.98), rgba(255, 171, 69, 0.9));
          color: #111826;
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 0.08em;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.28),
            0 14px 24px rgba(244, 129, 32, 0.18);
        }

        .cm-brand-badge {
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(94, 182, 255, 0.12);
          color: #9ed0ff;
          border: 1px solid rgba(94, 182, 255, 0.18);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .cm-brand-kicker {
          margin: 0;
          color: #f8a04d;
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-weight: 800;
        }

        .cm-brand-title {
          margin: 4px 0 0;
          font-size: 24px;
          line-height: 1.05;
          color: #f8fbff;
          font-weight: 800;
        }

        .cm-brand-copy {
          margin: 0;
          color: rgba(229, 238, 247, 0.72);
          font-size: 14px;
          line-height: 1.7;
        }

        .cm-brand-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .cm-brand-cell {
          padding: 10px 0;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          text-align: center;
        }

        .cm-brand-cell strong {
          display: block;
          font-size: 15px;
          color: #ffffff;
        }

        .cm-brand-cell span {
          display: block;
          margin-top: 4px;
          color: rgba(229, 238, 247, 0.64);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .cm-section-panel {
          padding: 14px;
        }

        .cm-section-title {
          margin: 0 0 10px;
          color: rgba(235, 241, 247, 0.7);
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 800;
        }

        .cm-nav-list,
        .cm-quick-list,
        .cm-signal-list {
          display: grid;
          gap: 8px;
        }

        .cm-nav-item {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 12px 12px;
          border-radius: 16px;
          border: 1px solid transparent;
          background: transparent;
          text-decoration: none;
          transition:
            transform 140ms ease,
            border-color 140ms ease,
            background-color 140ms ease;
        }

        .cm-nav-item:hover {
          transform: translateX(1px);
          border-color: rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.045);
        }

        .cm-nav-item[data-active="true"] {
          border-color: rgba(244, 129, 32, 0.24);
          background:
            linear-gradient(135deg, rgba(244, 129, 32, 0.12), rgba(255, 255, 255, 0.04));
        }

        .cm-nav-icon {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.22);
        }

        .cm-nav-item[data-active="true"] .cm-nav-icon {
          background: var(--cm-orange);
          box-shadow: 0 0 0 5px rgba(244, 129, 32, 0.14);
        }

        .cm-nav-copy {
          display: grid;
          gap: 3px;
        }

        .cm-nav-label {
          color: #f5f8fb;
          font-size: 15px;
          font-weight: 700;
        }

        .cm-nav-desc {
          color: rgba(229, 238, 247, 0.6);
          font-size: 12px;
        }

        .cm-nav-arrow {
          color: rgba(229, 238, 247, 0.38);
          font-size: 14px;
          font-weight: 700;
        }

        .cm-quick-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 12px;
          border-radius: 16px;
          text-decoration: none;
          color: rgba(245, 248, 251, 0.88);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .cm-quick-meta {
          display: grid;
          gap: 3px;
        }

        .cm-quick-meta strong {
          font-size: 14px;
        }

        .cm-quick-meta span {
          color: rgba(229, 238, 247, 0.62);
          font-size: 12px;
        }

        .cm-quick-open {
          color: #f8a04d;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .cm-signal-panel {
          padding: 14px;
        }

        .cm-signal-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 13px;
        }

        .cm-signal-row:first-child {
          border-top: none;
          padding-top: 0;
        }

        .cm-signal-row span:first-child {
          color: rgba(229, 238, 247, 0.6);
        }

        .cm-signal-row span:last-child {
          color: #f5f8fb;
          font-weight: 700;
          text-align: right;
        }

        .cm-main {
          min-width: 0;
          padding: 28px 30px 40px;
        }

        @media (max-width: 1024px) {
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
            padding: 18px 14px 28px;
          }
        }
      `}</style>

      <header class="cm-mobile-bar">
        <div class="cm-mobile-brand">
          <p class="cm-mobile-kicker">Personal knowledge</p>
          <p class="cm-mobile-title">CloudMind Workspace</p>
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
                  <span class="cm-nav-icon" />
                  <span class="cm-nav-copy">
                    <span class="cm-nav-label">{item.label}</span>
                    <span class="cm-nav-desc">{item.description}</span>
                  </span>
                  <span class="cm-nav-arrow">/</span>
                </a>
              ))}
            </div>
          </nav>
        </details>
      </header>

      <div class="cm-layout">
        <aside class="cm-sidebar">
          <div class="cm-sidebar-inner">
            <section class="cm-brand-panel">
              <div class="cm-brand-top">
                <span class="cm-brand-mark">CM</span>
                <span class="cm-brand-badge">Cloudflare-first</span>
              </div>
              <div>
                <p class="cm-brand-kicker">Knowledge workspace</p>
                <h1 class="cm-brand-title">CloudMind</h1>
              </div>
              <p class="cm-brand-copy">
                A private library for webpages, notes, PDFs, and AI-native
                conversations you can search, verify, and reuse.
              </p>
              <div class="cm-brand-grid">
                <div class="cm-brand-cell">
                  <strong>BYOC</strong>
                  <span>Deploy</span>
                </div>
                <div class="cm-brand-cell">
                  <strong>RAG</strong>
                  <span>Retrieve</span>
                </div>
                <div class="cm-brand-cell">
                  <strong>MVP</strong>
                  <span>Ship</span>
                </div>
              </div>
            </section>

            <section class="cm-section-panel">
              <p class="cm-section-title">Navigation</p>
              <nav class="cm-nav-list">
                {navigationItems.map((item) => (
                  <a
                    key={item.key}
                    class="cm-nav-item"
                    data-active={item.key === navigationKey}
                    href={item.href}
                  >
                    <span class="cm-nav-icon" />
                    <span class="cm-nav-copy">
                      <span class="cm-nav-label">{item.label}</span>
                      <span class="cm-nav-desc">{item.description}</span>
                    </span>
                    <span class="cm-nav-arrow">/</span>
                  </a>
                ))}
              </nav>
            </section>

            <section class="cm-section-panel">
              <p class="cm-section-title">Quick actions</p>
              <div class="cm-quick-list">
                {quickActions.map((action) => (
                  <a
                    key={action.label}
                    class="cm-quick-link"
                    href={action.href}
                  >
                    <span class="cm-quick-meta">
                      <strong>{action.label}</strong>
                      <span>{action.value}</span>
                    </span>
                    <span class="cm-quick-open">Open</span>
                  </a>
                ))}
              </div>
            </section>

            <section class="cm-signal-panel">
              <p class="cm-section-title">Workspace signals</p>
              <div class="cm-signal-list">
                {workspaceSignals.map((signal) => (
                  <div key={signal.label} class="cm-signal-row">
                    <span>{signal.label}</span>
                    <span>{signal.value}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </aside>

        <div class="cm-main">{children}</div>
      </div>
    </div>
  );
};
