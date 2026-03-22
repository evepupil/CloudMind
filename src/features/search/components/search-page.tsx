import { PageShell } from "@/features/layout/components/page-shell";
import type { SearchResult } from "@/features/search/model/types";

const starterQueries = [
  "Cloudflare deployment decisions",
  "What did I save about vector search?",
  "Recent notes about frontend refactor",
];

const buildStarterHref = (query: string): string => {
  return `/search?query=${encodeURIComponent(query)}`;
};

const formatDate = (value: string): string => {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
};

const formatScore = (value: number): string => {
  return value.toFixed(3);
};

const formatLabel = (value: string): string => {
  return value
    .split("_")
    .map((segment) =>
      segment.length > 0
        ? `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`
        : segment
    )
    .join(" ");
};

const getMatchLabel = (kind: SearchResult["items"][number]["kind"]): string => {
  if (kind === "chunk") {
    return "Chunk match";
  }

  if (kind === "assertion") {
    return "Assertion match";
  }

  return "Summary match";
};

const getScoreStyles = (value: number) => {
  if (value >= 0.85) {
    return {
      color: "#116149",
      bg: "#e7f7ef",
      border: "rgba(17, 97, 73, 0.18)",
      label: "Strong match",
    };
  }

  if (value >= 0.65) {
    return {
      color: "#0b5cab",
      bg: "#eaf4ff",
      border: "rgba(94, 182, 255, 0.22)",
      label: "Relevant",
    };
  }

  return {
    color: "#9a5a00",
    bg: "#fff2de",
    border: "rgba(244, 129, 32, 0.22)",
    label: "Weak match",
  };
};

// 这里把 Search 改成工作台内的检索面板，不再作为脱离壳层的单页。
export const SearchPage = ({
  result,
  query,
}: {
  result: SearchResult;
  query: string;
}) => {
  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;
  const hasResults = result.items.length > 0;

  return (
    <PageShell
      title="Search your library"
      subtitle="Run semantic retrieval across saved assets, inspect chunk-level matches, and decide what should be opened, compared, or asked next."
      navigationKey="search"
      actions={
        <>
          <a
            href="/ask"
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
            Open Ask
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
            Add sources
          </a>
        </>
      }
    >
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.55fr) minmax(300px, 0.82fr)",
          gap: "18px",
        }}
      >
        <div style={{ display: "grid", gap: "16px" }}>
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
                gap: "14px",
                flexWrap: "wrap",
                marginBottom: "14px",
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
                  Semantic retrieval
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
                  Query the knowledge graph-in-progress
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
                {result.pagination.total} retrieval matches
              </div>
            </div>

            <form
              method="get"
              action="/search"
              style={{
                display: "grid",
                gap: "12px",
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
                  Semantic query
                </span>
                <input
                  name="query"
                  type="search"
                  defaultValue={query}
                  placeholder="Search across notes, PDFs, and saved URLs by meaning"
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: "18px",
                    border: "1px solid rgba(21, 33, 51, 0.12)",
                    backgroundColor: "#fffdfa",
                    color: "#16202d",
                    fontSize: "15px",
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
                      fontSize: "14px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Search library
                  </button>
                  <span
                    style={{
                      padding: "12px 14px",
                      borderRadius: "999px",
                      backgroundColor: "#eef6ff",
                      color: "#0b5cab",
                      border: "1px solid rgba(94, 182, 255, 0.22)",
                      fontSize: "13px",
                      fontWeight: 700,
                    }}
                  >
                    Chunk + assertion + summary retrieval
                  </span>
                </div>
                <span
                  style={{
                    color: "#6b7685",
                    fontSize: "13px",
                  }}
                >
                  Page refresh for now. Async search can come next.
                </span>
              </div>
            </form>

            {!hasQuery ? (
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  marginTop: "16px",
                }}
              >
                {starterQueries.map((item) => (
                  <a
                    key={item}
                    href={buildStarterHref(item)}
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
                    {item}
                  </a>
                ))}
              </div>
            ) : null}
          </article>

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
                  Results
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
                  Retrieval output
                </h2>
              </div>
              <span
                style={{
                  color: "#566375",
                  fontSize: "13px",
                }}
              >
                Page {result.pagination.page} /{" "}
                {Math.max(result.pagination.totalPages, 1)}
              </span>
            </div>

            {!hasQuery ? (
              <article
                style={{
                  padding: "18px",
                  borderRadius: "20px",
                  backgroundColor: "#ffffff",
                  border: "1px dashed rgba(21, 33, 51, 0.14)",
                  color: "#566375",
                  lineHeight: 1.8,
                }}
              >
                输入一个主题、问题或技术决策方向，Search 会先召回最相关的
                chunk，再把它们还原成可查看的资产来源。
              </article>
            ) : !hasResults ? (
              <article
                style={{
                  padding: "18px",
                  borderRadius: "20px",
                  backgroundColor: "#ffffff",
                  border: "1px dashed rgba(21, 33, 51, 0.14)",
                  color: "#566375",
                  lineHeight: 1.8,
                }}
              >
                没有找到匹配结果。可以换一种表达方式，或者先去 Capture
                增加上下文资产再回来搜索。
              </article>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {result.items.map((item, index) => {
                  const scoreStyle = getScoreStyles(item.score);
                  const asset =
                    item.kind === "chunk"
                      ? item.chunk.asset
                      : item.kind === "assertion"
                        ? item.assertion.asset
                        : item.asset;
                  const excerpt =
                    item.kind === "chunk"
                      ? item.chunk.textPreview
                      : item.kind === "assertion"
                        ? item.assertion.text
                        : item.summary;
                  const indexing = item.indexing;
                  const indexingTags = [
                    indexing.domain,
                    indexing.documentClass,
                    indexing.assertionKind,
                    indexing.sourceHost,
                    ...indexing.topics,
                  ].filter((value): value is string => Boolean(value?.trim()));

                  return (
                    <article
                      key={
                        item.kind === "chunk"
                          ? item.chunk.id
                          : item.kind === "assertion"
                            ? `assertion:${item.assertion.id}`
                            : `summary:${item.asset.id}`
                      }
                      style={{
                        padding: "18px 18px 20px",
                        borderRadius: "22px",
                        border: "1px solid rgba(21, 33, 51, 0.08)",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "14px",
                          flexWrap: "wrap",
                          marginBottom: "10px",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "8px",
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
                                backgroundColor: "#f8f0ff",
                                color: "#7a3fb2",
                                border: "1px solid rgba(122, 63, 178, 0.16)",
                                fontSize: "11px",
                                fontWeight: 800,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                              }}
                            >
                              {getMatchLabel(item.kind)}
                            </span>
                            <span
                              style={{
                                padding: "5px 8px",
                                borderRadius: "999px",
                                backgroundColor: scoreStyle.bg,
                                color: scoreStyle.color,
                                border: `1px solid ${scoreStyle.border}`,
                                fontSize: "11px",
                                fontWeight: 800,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                              }}
                            >
                              {scoreStyle.label}
                            </span>
                          </div>
                          {indexingTags.length > 0 ? (
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                flexWrap: "wrap",
                                marginBottom: "8px",
                              }}
                            >
                              {indexingTags.map((tag) => (
                                <span
                                  key={`${asset.id}:${item.kind}:${tag}`}
                                  style={{
                                    padding: "5px 8px",
                                    borderRadius: "999px",
                                    backgroundColor: "#f4f7fb",
                                    color: "#4b5a6b",
                                    fontSize: "11px",
                                    fontWeight: 800,
                                  }}
                                >
                                  {formatLabel(tag)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <a
                            href={`/assets/${asset.id}`}
                            style={{
                              color: "#16202d",
                              textDecoration: "none",
                              fontSize: "20px",
                              fontWeight: 800,
                            }}
                          >
                            {asset.title}
                          </a>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: "6px",
                            minWidth: "142px",
                            justifyItems: "end",
                          }}
                        >
                          <span
                            style={{
                              color: "#16202d",
                              fontSize: "16px",
                              fontWeight: 800,
                            }}
                          >
                            {formatScore(item.score)}
                          </span>
                          <span
                            style={{
                              color: "#6b7685",
                              fontSize: "12px",
                            }}
                          >
                            Match #{index + 1}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          flexWrap: "wrap",
                          marginBottom: "10px",
                          color: "#6b7685",
                          fontSize: "13px",
                        }}
                      >
                        {item.kind === "chunk" ? (
                          <span>Chunk #{item.chunk.chunkIndex}</span>
                        ) : item.kind === "assertion" ? (
                          <span>Assertion #{item.assertion.assertionIndex}</span>
                        ) : (
                          <span>Summary-only access</span>
                        )}
                        <span>{`Layer: ${formatLabel(indexing.matchedLayer)}`}</span>
                        <span>{`Visibility: ${formatLabel(indexing.aiVisibility)}`}</span>
                        {indexing.collectionKey ? (
                          <span>{`Collection: ${indexing.collectionKey}`}</span>
                        ) : null}
                        <span>{formatDate(asset.createdAt)}</span>
                        <span>
                          {asset.sourceUrl ?? `Asset ID: ${asset.id}`}
                        </span>
                      </div>

                      <p
                        style={{
                          margin: "0 0 14px",
                          color: "#3b4757",
                          lineHeight: 1.82,
                          fontSize: "15px",
                        }}
                      >
                        {excerpt}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <a
                          href={`/assets/${asset.id}`}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "14px",
                            backgroundColor: "#16202d",
                            color: "#ffffff",
                            textDecoration: "none",
                            fontSize: "13px",
                            fontWeight: 700,
                          }}
                        >
                          Open asset
                        </a>
                        <a
                          href={`/ask?question=${encodeURIComponent(
                            `Based on ${asset.title}, ${trimmedQuery}`
                          )}`}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "14px",
                            backgroundColor: "#fff1dd",
                            color: "#b55d0a",
                            textDecoration: "none",
                            fontSize: "13px",
                            fontWeight: 700,
                            border: "1px solid rgba(244, 129, 32, 0.22)",
                          }}
                        >
                          Ask from result
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

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
              Search telemetry
            </p>
            <div style={{ display: "grid", gap: "10px" }}>
              {[
                {
                  label: "Query state",
                  value: hasQuery ? "Active" : "Idle",
                },
                {
                  label: "Total matches",
                  value: String(result.pagination.total),
                },
                {
                  label: "Page size",
                  value: String(result.pagination.pageSize),
                },
                {
                  label: "Top page",
                  value: String(result.pagination.page),
                },
              ].map((item, index) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    paddingTop: index === 0 ? "0" : "10px",
                    borderTop:
                      index === 0 ? "none" : "1px solid rgba(21, 33, 51, 0.08)",
                    color: "#566375",
                    fontSize: "13px",
                  }}
                >
                  <span>{item.label}</span>
                  <span
                    style={{
                      color: "#16202d",
                      fontWeight: 700,
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
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
              Search guide
            </p>
            <div style={{ display: "grid", gap: "12px" }}>
              {[
                "Search works on chunks, not whole documents, so ask about concepts rather than titles only.",
                "Layered index chips show domain, document class, assertion kind, and topics extracted during ingest.",
                "Summary-only assets can appear as abstracted matches when the raw body is not AI-visible.",
                "If a result looks close but incomplete, jump into Ask and turn that query into a source-aware follow-up.",
                "Weak or empty results usually mean the library lacks enough processed context, not necessarily that retrieval is wrong.",
              ].map((tip, index) => (
                <div
                  key={tip}
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
                      lineHeight: 1.75,
                    }}
                  >
                    {tip}
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
