import type { AssetSummary } from "@/features/assets/model/types";

import { PageShell } from "@/features/layout/components/page-shell";

const overviewMetrics = [
  {
    label: "Assets indexed",
    value: "1,248",
    note: "+32 this week",
  },
  {
    label: "Items processing",
    value: "07",
    note: "Queue active",
  },
  {
    label: "Answer coverage",
    value: "84%",
    note: "With evidence",
  },
  {
    label: "Failed jobs",
    value: "02",
    note: "Needs retry",
  },
];

const activityFeed: AssetSummary[] = [
  {
    id: "asset-ops-1",
    type: "url",
    title: "Cloudflare Pages deployment notes",
    summary:
      "Collected a deployment decision log covering Pages, D1 bindings, and service boundaries for the MVP.",
    sourceUrl: "https://developers.cloudflare.com/",
    status: "ready",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "asset-ops-2",
    type: "note",
    title: "Knowledge ingestion backlog",
    summary:
      "A short operator note defining what should land in v0.1 before browser extension and export work begin.",
    sourceUrl: null,
    status: "processing",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "asset-ops-3",
    type: "chat",
    title: "Ask Library reliability checklist",
    summary:
      "Captured requirements for evidence-first answers, chunk citations, and a stable retrieval loop.",
    sourceUrl: null,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const pipelineSteps = [
  {
    title: "Capture",
    copy: "Save URLs, text, PDFs, and future MCP events through one intake layer.",
  },
  {
    title: "Process",
    copy: "Extract, clean, summarize, chunk, embed, and keep every derived artifact rebuildable.",
  },
  {
    title: "Retrieve",
    copy: "Search and Ask should operate on evidence-first retrieval, not fluent guesses.",
  },
];

const actionCards = [
  {
    title: "Open Library",
    description:
      "Inspect assets, statuses, and summaries with less dashboard noise.",
    href: "/assets",
    tone: "#16202d",
    bg: "#ffffff",
    border: "rgba(21, 33, 51, 0.12)",
  },
  {
    title: "Capture Source",
    description: "Send a webpage, note, or PDF into the ingest pipeline.",
    href: "/capture",
    tone: "#16202d",
    bg: "#fff5e8",
    border: "rgba(244, 129, 32, 0.22)",
  },
  {
    title: "Ask with Evidence",
    description: "Question the library and verify where the answer came from.",
    href: "/ask",
    tone: "#16202d",
    bg: "#eef6ff",
    border: "rgba(94, 182, 255, 0.22)",
  },
];

const statusStyles: Record<
  AssetSummary["status"],
  { color: string; bg: string; border: string }
> = {
  pending: {
    color: "#9a5a00",
    bg: "#fff2de",
    border: "rgba(244, 129, 32, 0.22)",
  },
  processing: {
    color: "#0b5cab",
    bg: "#eaf4ff",
    border: "rgba(94, 182, 255, 0.22)",
  },
  ready: {
    color: "#116149",
    bg: "#e7f7ef",
    border: "rgba(17, 97, 73, 0.18)",
  },
  failed: {
    color: "#a12d28",
    bg: "#ffebe8",
    border: "rgba(161, 45, 40, 0.18)",
  },
};

// 这里重做 Overview，让它更像 Cloudflare 风格的产品工作台首页，而不是营销海报。
export const HomePage = () => {
  return (
    <PageShell
      title="Operate your private knowledge system"
      subtitle="CloudMind should feel like a calm control surface for capture, processing, retrieval, and source-aware answers."
      navigationKey="overview"
      actions={
        <>
          <a
            href="/capture"
            style={{
              padding: "12px 16px",
              borderRadius: "999px",
              backgroundColor: "#16202d",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            New capture
          </a>
          <a
            href="/ask"
            style={{
              padding: "12px 16px",
              borderRadius: "999px",
              backgroundColor: "#fff1dd",
              color: "#b55d0a",
              textDecoration: "none",
              fontWeight: 700,
              border: "1px solid rgba(244, 129, 32, 0.22)",
            }}
          >
            Open Ask
          </a>
        </>
      }
    >
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.45fr) minmax(320px, 0.9fr)",
          gap: "18px",
          marginBottom: "18px",
        }}
      >
        <article
          style={{
            padding: "28px",
            borderRadius: "30px",
            border: "1px solid rgba(21, 33, 51, 0.08)",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(255,245,232,0.96) 100%)",
            boxShadow: "0 24px 58px rgba(28, 39, 56, 0.07)",
          }}
        >
          <p
            style={{
              margin: "0 0 10px",
              color: "#f48120",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            Operator summary
          </p>
          <h2
            style={{
              margin: 0,
              color: "#16202d",
              fontSize: "clamp(30px, 4vw, 44px)",
              lineHeight: 1.03,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              maxWidth: "12ch",
            }}
          >
            Build a library that answers with receipts.
          </h2>
          <p
            style={{
              margin: "14px 0 0",
              color: "#566375",
              fontSize: "16px",
              lineHeight: 1.8,
              maxWidth: "66ch",
            }}
          >
            The homepage should immediately show what entered the system, what
            still needs processing, and what questions the user can ask next
            without losing trust in the source chain.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "12px",
              marginTop: "22px",
            }}
          >
            {overviewMetrics.map((metric) => (
              <article
                key={metric.label}
                style={{
                  padding: "16px 16px 18px",
                  borderRadius: "18px",
                  backgroundColor: "rgba(255, 255, 255, 0.72)",
                  border: "1px solid rgba(21, 33, 51, 0.08)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px",
                    color: "#6b7685",
                    fontSize: "12px",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {metric.label}
                </p>
                <p
                  style={{
                    margin: 0,
                    color: "#16202d",
                    fontSize: "32px",
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {metric.value}
                </p>
                <p
                  style={{
                    margin: "8px 0 0",
                    color: "#566375",
                    fontSize: "13px",
                  }}
                >
                  {metric.note}
                </p>
              </article>
            ))}
          </div>
        </article>

        <article
          style={{
            padding: "24px",
            borderRadius: "30px",
            border: "1px solid rgba(21, 33, 51, 0.08)",
            backgroundColor: "#fffdfa",
            boxShadow: "0 24px 58px rgba(28, 39, 56, 0.06)",
          }}
        >
          <p
            style={{
              margin: "0 0 12px",
              color: "#16202d",
              fontSize: "18px",
              fontWeight: 800,
            }}
          >
            Processing model
          </p>
          <div style={{ display: "grid", gap: "12px" }}>
            {pipelineSteps.map((step, index) => (
              <article
                key={step.title}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px minmax(0, 1fr)",
                  gap: "14px",
                  padding: "14px 0",
                  borderTop:
                    index === 0 ? "none" : "1px solid rgba(21, 33, 51, 0.08)",
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "999px",
                    backgroundColor:
                      index === 0
                        ? "#fff1dd"
                        : index === 1
                          ? "#eef6ff"
                          : "#eef7f1",
                    color:
                      index === 0
                        ? "#b55d0a"
                        : index === 1
                          ? "#0b5cab"
                          : "#116149",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "12px",
                    fontWeight: 800,
                  }}
                >
                  {index + 1}
                </div>
                <div>
                  <h3
                    style={{
                      margin: "0 0 6px",
                      color: "#16202d",
                      fontSize: "16px",
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      color: "#566375",
                      lineHeight: 1.75,
                    }}
                  >
                    {step.copy}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
          marginBottom: "18px",
        }}
      >
        {actionCards.map((card) => (
          <a
            key={card.title}
            href={card.href}
            style={{
              padding: "20px 20px 22px",
              borderRadius: "24px",
              textDecoration: "none",
              color: card.tone,
              backgroundColor: card.bg,
              border: `1px solid ${card.border}`,
              boxShadow: "0 18px 42px rgba(28, 39, 56, 0.05)",
            }}
          >
            <p
              style={{
                margin: "0 0 10px",
                color: "#6b7685",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Launch
            </p>
            <h3
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: 800,
              }}
            >
              {card.title}
            </h3>
            <p
              style={{
                margin: "10px 0 0",
                color: "#566375",
                lineHeight: 1.75,
              }}
            >
              {card.description}
            </p>
          </a>
        ))}
      </section>

      <section
        style={{
          padding: "24px",
          borderRadius: "30px",
          backgroundColor: "#fffdfa",
          border: "1px solid rgba(21, 33, 51, 0.08)",
          boxShadow: "0 22px 52px rgba(28, 39, 56, 0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "12px",
            marginBottom: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 6px",
                color: "#f48120",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              Recent activity
            </p>
            <h2
              style={{
                margin: 0,
                fontSize: "28px",
                color: "#16202d",
                fontWeight: 800,
                letterSpacing: "-0.03em",
              }}
            >
              What changed in the library
            </h2>
          </div>
          <a
            href="/search"
            style={{
              color: "#16202d",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Search across assets
          </a>
        </div>

        <div style={{ display: "grid", gap: "12px" }}>
          {activityFeed.map((asset) => {
            const statusStyle = statusStyles[asset.status];

            return (
              <article
                key={asset.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1.4fr) auto",
                  gap: "16px",
                  alignItems: "start",
                  padding: "18px 18px 20px",
                  borderRadius: "20px",
                  border: "1px solid rgba(21, 33, 51, 0.08)",
                  backgroundColor: "#ffffff",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "8px",
                    }}
                  >
                    <span
                      style={{
                        padding: "5px 8px",
                        borderRadius: "999px",
                        backgroundColor: "#f3f5f8",
                        color: "#5f6b7d",
                        fontSize: "11px",
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      {asset.type}
                    </span>
                    <span
                      style={{
                        padding: "5px 8px",
                        borderRadius: "999px",
                        backgroundColor: statusStyle.bg,
                        color: statusStyle.color,
                        border: `1px solid ${statusStyle.border}`,
                        fontSize: "11px",
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      {asset.status}
                    </span>
                  </div>
                  <h3
                    style={{
                      margin: "0 0 8px",
                      color: "#16202d",
                      fontSize: "20px",
                      fontWeight: 800,
                    }}
                  >
                    {asset.title}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      color: "#566375",
                      lineHeight: 1.75,
                    }}
                  >
                    {asset.summary}
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    minWidth: "164px",
                  }}
                >
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: "14px",
                      backgroundColor: "#f7f8fa",
                      color: "#566375",
                      fontSize: "13px",
                    }}
                  >
                    {asset.sourceUrl ?? "Local or manual source"}
                  </div>
                  <a
                    href="/ask"
                    style={{
                      padding: "11px 12px",
                      borderRadius: "14px",
                      backgroundColor: "#16202d",
                      color: "#ffffff",
                      textDecoration: "none",
                      textAlign: "center",
                      fontSize: "13px",
                      fontWeight: 700,
                    }}
                  >
                    Ask from this context
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
};
