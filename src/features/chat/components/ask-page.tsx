import type { AskLibraryResult } from "@/features/chat/model/types";
import { PageShell } from "@/features/layout/components/page-shell";

const suggestionPrompts = [
  "Summarize what I saved this week.",
  "Which assets mention Cloudflare deployment tradeoffs?",
  "What should be fixed before the next frontend refactor batch?",
];

const retrievalStages = [
  "Embed the question",
  "Retrieve the highest scoring chunks",
  "Ground the answer in cited evidence",
];

const buildSuggestionHref = (prompt: string): string => {
  return `/ask?question=${encodeURIComponent(prompt)}`;
};

// 这里先把 Ask 重构成更像工作台的问答面板，强调提问、回答和证据三栏关系。
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
      title="Ask with grounded evidence"
      subtitle="Use retrieval-first answers so CloudMind behaves less like a chatbot and more like a verifiable research operator."
      navigationKey="ask"
      actions={
        <>
          <a
            href="/search"
            style={{
              padding: "12px 16px",
              borderRadius: "999px",
              backgroundColor: "#ffffff",
              color: "#16202d",
              textDecoration: "none",
              fontWeight: 700,
              border: "1px solid rgba(21, 33, 51, 0.1)",
            }}
          >
            Search first
          </a>
          <a
            href="/capture"
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
            Add more context
          </a>
        </>
      }
    >
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.55fr) minmax(320px, 0.85fr)",
          gap: "18px",
        }}
      >
        <article
          style={{
            padding: "24px",
            borderRadius: "30px",
            border: "1px solid rgba(21, 33, 51, 0.08)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,250,245,0.96) 100%)",
            boxShadow: "0 24px 58px rgba(28, 39, 56, 0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "16px",
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
                Answer workspace
              </p>
              <h2
                style={{
                  margin: 0,
                  color: "#16202d",
                  fontSize: "28px",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                }}
              >
                Query, answer, verify
              </h2>
            </div>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "16px",
                backgroundColor: "#f6f7f9",
                border: "1px solid rgba(21, 33, 51, 0.08)",
                color: "#566375",
                fontSize: "13px",
              }}
            >
              Retrieval mode: chunks + summary-only assets
            </div>
          </div>

          <form
            method="get"
            action="/ask"
            style={{
              display: "grid",
              gap: "12px",
              marginBottom: "18px",
            }}
          >
            <label style={{ display: "grid", gap: "8px" }}>
              <span
                style={{
                  color: "#16202d",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                Ask a grounded question
              </span>
              <textarea
                name="question"
                rows={5}
                defaultValue={question}
                placeholder="Ask CloudMind to explain, compare, summarize, or locate something in your saved library..."
                style={{
                  width: "100%",
                  padding: "16px 18px",
                  borderRadius: "22px",
                  border: "1px solid rgba(21, 33, 51, 0.12)",
                  backgroundColor: "#fffdfa",
                  color: "#16202d",
                  fontSize: "15px",
                  lineHeight: 1.7,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="submit"
                  style={{
                    padding: "12px 18px",
                    borderRadius: "999px",
                    border: "none",
                    backgroundColor: "#16202d",
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Ask Library
                </button>
                <span
                  style={{
                    padding: "12px 14px",
                    borderRadius: "999px",
                    backgroundColor: "#fff1dd",
                    color: "#b55d0a",
                    border: "1px solid rgba(244, 129, 32, 0.22)",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  Evidence required
                </span>
              </div>
              <span
                style={{
                  color: "#6b7685",
                  fontSize: "13px",
                }}
              >
                Full-page submit for now. AJAX comes next.
              </span>
            </div>
          </form>

          <div
            style={{
              display: "grid",
              gap: "14px",
            }}
          >
            {hasQuestion ? (
              <article
                style={{
                  padding: "18px 20px",
                  borderRadius: "22px",
                  backgroundColor: "#eef6ff",
                  border: "1px solid rgba(94, 182, 255, 0.2)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px",
                    color: "#0b5cab",
                    fontSize: "11px",
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  User query
                </p>
                <p
                  style={{
                    margin: 0,
                    color: "#16202d",
                    lineHeight: 1.8,
                    fontSize: "15px",
                  }}
                >
                  {question}
                </p>
              </article>
            ) : null}

            <article
              style={{
                padding: "20px 22px",
                borderRadius: "24px",
                backgroundColor: "#ffffff",
                border: "1px solid rgba(21, 33, 51, 0.08)",
              }}
            >
              <p
                style={{
                  margin: "0 0 10px",
                  color: "#16202d",
                  fontSize: "12px",
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                CloudMind answer
              </p>
              {errorMessage ? (
                <p
                  style={{
                    margin: 0,
                    color: "#a12d28",
                    lineHeight: 1.85,
                    fontSize: "15px",
                  }}
                >
                  {errorMessage}
                </p>
              ) : result ? (
                <p
                  style={{
                    margin: 0,
                    color: "#3b4757",
                    lineHeight: 1.95,
                    fontSize: "15px",
                  }}
                >
                  {result.answer}
                </p>
              ) : (
                <p
                  style={{
                    margin: 0,
                    color: "#566375",
                    lineHeight: 1.85,
                    fontSize: "15px",
                  }}
                >
                  Ask a question about your saved material. The answer area is
                  designed to stay readable, with evidence cards alongside it
                  instead of burying sources after the fact.
                </p>
              )}
            </article>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "18px",
            }}
          >
            {suggestionPrompts.map((prompt) => (
              <a
                key={prompt}
                href={buildSuggestionHref(prompt)}
                style={{
                  padding: "10px 12px",
                  borderRadius: "999px",
                  backgroundColor: "#f5f7fa",
                  border: "1px solid rgba(21, 33, 51, 0.08)",
                  color: "#566375",
                  fontSize: "13px",
                  textDecoration: "none",
                }}
              >
                {prompt}
              </a>
            ))}
          </div>
        </article>

        <aside style={{ display: "grid", gap: "16px" }}>
          <article
            style={{
              padding: "20px",
              borderRadius: "28px",
              border: "1px solid rgba(21, 33, 51, 0.08)",
              backgroundColor: "#fffdfa",
              boxShadow: "0 20px 46px rgba(28, 39, 56, 0.05)",
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
              Evidence panel
            </p>
            <h3
              style={{
                margin: "0 0 12px",
                color: "#16202d",
                fontSize: "22px",
                fontWeight: 800,
              }}
            >
              Retrieved sources
            </h3>
            <div style={{ display: "grid", gap: "12px" }}>
              {result?.sources.length ? (
                result.sources.map((source, index) => (
                  <article
                    key={`${source.assetId}:${source.chunkId ?? "source"}`}
                    style={{
                      padding: "16px",
                      borderRadius: "18px",
                      backgroundColor: index === 0 ? "#fff5e8" : "#ffffff",
                      border:
                        index === 0
                          ? "1px solid rgba(244, 129, 32, 0.22)"
                          : "1px solid rgba(21, 33, 51, 0.08)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "10px",
                        alignItems: "center",
                        marginBottom: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <a
                        href={`/assets/${source.assetId}`}
                        style={{
                          color: "#16202d",
                          textDecoration: "none",
                          fontWeight: 800,
                        }}
                      >
                        {source.title}
                      </a>
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
                        {source.sourceType === "chunk"
                          ? `Chunk ${index + 1}`
                          : `Summary ${index + 1}`}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        color: "#566375",
                        lineHeight: 1.75,
                        fontSize: "14px",
                      }}
                    >
                      {source.snippet}
                    </p>
                    <p
                      style={{
                        margin: "10px 0 0",
                        color: "#6b7685",
                        fontSize: "12px",
                      }}
                    >
                      {source.sourceUrl ?? `Asset ID: ${source.assetId}`}
                    </p>
                  </article>
                ))
              ) : (
                <article
                  style={{
                    padding: "16px",
                    borderRadius: "18px",
                    border: "1px dashed rgba(21, 33, 51, 0.14)",
                    color: "#566375",
                    backgroundColor: "#ffffff",
                    lineHeight: 1.75,
                  }}
                >
                  Submit a question to see retrieved chunks, summary-only
                  sources, and evidence cards here.
                </article>
              )}
            </div>
          </article>

          <article
            style={{
              padding: "20px",
              borderRadius: "28px",
              border: "1px solid rgba(21, 33, 51, 0.08)",
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(238,246,255,0.96) 100%)",
              boxShadow: "0 20px 46px rgba(28, 39, 56, 0.05)",
            }}
          >
            <p
              style={{
                margin: "0 0 10px",
                color: "#0b5cab",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              Retrieval chain
            </p>
            <div style={{ display: "grid", gap: "12px" }}>
              {retrievalStages.map((stage, index) => (
                <div
                  key={stage}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "26px minmax(0, 1fr)",
                    gap: "12px",
                    alignItems: "start",
                  }}
                >
                  <span
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "999px",
                      backgroundColor: "#ffffff",
                      border: "1px solid rgba(94, 182, 255, 0.22)",
                      color: "#0b5cab",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "12px",
                      fontWeight: 800,
                    }}
                  >
                    {index + 1}
                  </span>
                  <p
                    style={{
                      margin: "4px 0 0",
                      color: "#3b4757",
                      lineHeight: 1.7,
                    }}
                  >
                    {stage}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </PageShell>
  );
};
