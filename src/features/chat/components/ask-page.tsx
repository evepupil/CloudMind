import { PageShell } from "@/features/layout/components/page-shell";

const suggestionPrompts = [
  "Summarize what I saved this week.",
  "What are the main themes across my recent notes?",
  "Which assets mention Cloudflare deployment choices?",
];

const evidenceCards = [
  {
    title: "CloudMind Pages 全栈原型",
    snippet:
      "The current MVP keeps pages and API in one HonoX project so deployment stays simple.",
    href: "/assets",
  },
  {
    title: "知识采集闭环",
    snippet:
      "Capture should prioritize URL, PDF, and text first before expanding into heavier workflows.",
    href: "/assets",
  },
];

// 这里提供 Ask 页原型，先把对话区和证据区的产品结构立起来。
export const AskPage = () => {
  return (
    <PageShell
      title="Ask your library"
      subtitle="Turn CloudMind into a source-aware research partner. Answers should come with evidence, not just fluent text."
      navigationKey="ask"
      actions={
        <a
          href="/search"
          style={{
            padding: "12px 18px",
            borderRadius: "999px",
            backgroundColor: "#dff7f5",
            color: "#0f766e",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Search Sources
        </a>
      }
    >
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.25fr) minmax(280px, 0.75fr)",
          gap: "18px",
        }}
      >
        <article
          style={{
            padding: "24px",
            borderRadius: "24px",
            backgroundColor: "#ffffff",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            boxShadow: "0 18px 48px rgba(15, 23, 42, 0.08)",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: "14px",
            }}
          >
            <article
              style={{
                padding: "18px",
                borderRadius: "18px",
                backgroundColor: "#eef6ff",
              }}
            >
              <strong style={{ display: "block", marginBottom: "8px" }}>
                You
              </strong>
              <p style={{ margin: 0, lineHeight: 1.75 }}>
                What changed in the product direction for the frontend?
              </p>
            </article>
            <article
              style={{
                padding: "18px",
                borderRadius: "18px",
                backgroundColor: "#f8fbfc",
                border: "1px solid rgba(15, 23, 42, 0.06)",
              }}
            >
              <strong style={{ display: "block", marginBottom: "8px" }}>
                CloudMind
              </strong>
              <p style={{ margin: 0, color: "#445160", lineHeight: 1.85 }}>
                The direction shifted away from a backend-shaped admin panel and
                toward a knowledge workspace with four primary areas: Overview,
                Library, Capture, and Ask. The frontend should emphasize
                browsing assets, understanding processing state, and grounding
                answers in evidence.
              </p>
            </article>
          </div>

          <form style={{ marginTop: "22px", display: "grid", gap: "12px" }}>
            <label style={{ display: "grid", gap: "8px" }}>
              <span style={{ fontWeight: 700 }}>Ask a follow-up</span>
              <textarea
                rows={5}
                placeholder="Ask a question grounded in your saved library..."
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: "18px",
                  border: "1px solid rgba(15, 23, 42, 0.12)",
                  fontSize: "15px",
                  resize: "vertical",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <button
                type="submit"
                style={{
                  padding: "12px 18px",
                  borderRadius: "999px",
                  border: "none",
                  backgroundColor: "#102033",
                  color: "#ffffff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Ask Library
              </button>
              {suggestionPrompts.map((prompt) => (
                <span
                  key={prompt}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "999px",
                    backgroundColor: "#eef2f7",
                    color: "#526071",
                    fontSize: "13px",
                  }}
                >
                  {prompt}
                </span>
              ))}
            </div>
          </form>
        </article>

        <aside style={{ display: "grid", gap: "16px" }}>
          <article
            style={{
              padding: "20px",
              borderRadius: "24px",
              backgroundColor: "#ffffff",
              border: "1px solid rgba(15, 23, 42, 0.08)",
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: "20px" }}>Evidence Panel</h3>
            <p style={{ color: "#526071", lineHeight: 1.8 }}>
              Answers should cite the assets and snippets that informed the
              response.
            </p>
            <div style={{ display: "grid", gap: "12px" }}>
              {evidenceCards.map((card) => (
                <article
                  key={card.title}
                  style={{
                    padding: "16px",
                    borderRadius: "18px",
                    backgroundColor: "#f8fbfc",
                    border: "1px solid rgba(15, 23, 42, 0.06)",
                  }}
                >
                  <a
                    href={card.href}
                    style={{
                      color: "#102033",
                      textDecoration: "none",
                      fontWeight: 700,
                    }}
                  >
                    {card.title}
                  </a>
                  <p
                    style={{
                      marginBottom: 0,
                      color: "#526071",
                      lineHeight: 1.75,
                    }}
                  >
                    {card.snippet}
                  </p>
                </article>
              ))}
            </div>
          </article>

          <article
            style={{
              padding: "20px",
              borderRadius: "24px",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.94) 0%, rgba(232, 250, 244, 0.9) 100%)",
              border: "1px solid rgba(15, 23, 42, 0.08)",
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: "20px" }}>Context Scope</h3>
            <p style={{ margin: 0, color: "#526071", lineHeight: 1.8 }}>
              Future versions should let users ask within selected assets, tags,
              or recent captures instead of searching the whole library by
              default.
            </p>
          </article>
        </aside>
      </section>
    </PageShell>
  );
};
