import type { AskLibraryResult } from "@/features/chat/model/types";
import { PageShell } from "@/features/layout/components/page-shell";

const suggestionPrompts = [
  "Summarize what I saved this week.",
  "What are the main themes across my recent notes?",
  "Which assets mention Cloudflare deployment choices?",
];

const buildSuggestionHref = (prompt: string): string => {
  return `/ask?question=${encodeURIComponent(prompt)}`;
};

// 这里提供 Ask 页最小可用界面，直接展示问答结果与来源卡片。
export const AskPage = ({
  question,
  result,
  errorMessage,
}: {
  question: string;
  result: AskLibraryResult | null;
  errorMessage: string | null;
}) => {
  const hasQuestion = question.trim().length > 0;

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
            {hasQuestion ? (
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
                <p style={{ margin: 0, lineHeight: 1.75 }}>{question}</p>
              </article>
            ) : null}
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
              {errorMessage ? (
                <p
                  style={{
                    margin: 0,
                    color: "#b91c1c",
                    lineHeight: 1.85,
                  }}
                >
                  {errorMessage}
                </p>
              ) : result ? (
                <p style={{ margin: 0, color: "#445160", lineHeight: 1.85 }}>
                  {result.answer}
                </p>
              ) : (
                <p style={{ margin: 0, color: "#445160", lineHeight: 1.85 }}>
                  Ask a question grounded in your saved assets. CloudMind will
                  retrieve relevant chunks first, then answer with cited
                  evidence.
                </p>
              )}
            </article>
          </div>

          <form
            method="get"
            action="/ask"
            style={{ marginTop: "22px", display: "grid", gap: "12px" }}
          >
            <label style={{ display: "grid", gap: "8px" }}>
              <span style={{ fontWeight: 700 }}>Ask a follow-up</span>
              <textarea
                name="question"
                rows={5}
                defaultValue={question}
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
                <a
                  key={prompt}
                  href={buildSuggestionHref(prompt)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "999px",
                    backgroundColor: "#eef2f7",
                    color: "#526071",
                    fontSize: "13px",
                    textDecoration: "none",
                  }}
                >
                  {prompt}
                </a>
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
              {result?.sources.length ? (
                result.sources.map((source) => (
                  <article
                    key={`${source.assetId}:${source.chunkId ?? "source"}`}
                    style={{
                      padding: "16px",
                      borderRadius: "18px",
                      backgroundColor: "#f8fbfc",
                      border: "1px solid rgba(15, 23, 42, 0.06)",
                    }}
                  >
                    <a
                      href={`/assets/${source.assetId}`}
                      style={{
                        color: "#102033",
                        textDecoration: "none",
                        fontWeight: 700,
                      }}
                    >
                      {source.title}
                    </a>
                    <p
                      style={{
                        marginBottom: "8px",
                        color: "#526071",
                        lineHeight: 1.75,
                      }}
                    >
                      {source.snippet}
                    </p>
                    <div style={{ color: "#64748b", fontSize: "13px" }}>
                      {source.sourceUrl ?? `Asset ID: ${source.assetId}`}
                    </div>
                  </article>
                ))
              ) : (
                <article
                  style={{
                    padding: "16px",
                    borderRadius: "18px",
                    backgroundColor: "#f8fbfc",
                    border: "1px dashed rgba(15, 23, 42, 0.12)",
                    color: "#526071",
                  }}
                >
                  Submit a question to see the retrieved evidence here.
                </article>
              )}
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
              Right now every question searches the whole library. The next step
              is letting users limit scope by asset, type, or tag before asking.
            </p>
          </article>
        </aside>
      </section>
    </PageShell>
  );
};
