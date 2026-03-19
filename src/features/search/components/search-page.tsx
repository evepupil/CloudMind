import type { SearchResult } from "@/features/search/model/types";

const formatDate = (value: string): string => {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
};

const formatScore = (value: number): string => {
  return value.toFixed(3);
};

export const SearchPage = ({
  result,
  query,
}: {
  result: SearchResult;
  query: string;
}) => {
  return (
    <main
      style={{
        maxWidth: "960px",
        margin: "0 auto",
        padding: "48px 24px 80px",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <header style={{ marginBottom: "32px" }}>
        <p
          style={{
            margin: 0,
            color: "#4f46e5",
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          CloudMind
        </p>
        <h1 style={{ margin: "12px 0", fontSize: "40px", lineHeight: 1.1 }}>
          Search
        </h1>
        <p style={{ margin: 0, color: "#475569", fontSize: "18px" }}>
          先用语义向量召回 chunk，再回填对应资产信息。
        </p>
      </header>
      <form
        method="get"
        action="/search"
        style={{
          display: "grid",
          gap: "12px",
          marginBottom: "24px",
          padding: "24px",
          borderRadius: "20px",
          border: "1px solid #e2e8f0",
          background:
            "linear-gradient(135deg, #f8fafc 0%, #eff6ff 55%, #fefce8 100%)",
        }}
      >
        <label style={{ display: "grid", gap: "8px" }}>
          <span style={{ fontWeight: 700 }}>Semantic Query</span>
          <input
            name="query"
            type="search"
            defaultValue={query}
            placeholder="Search by meaning across notes and PDFs"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid #cbd5e1",
              fontSize: "15px",
            }}
          />
        </label>
        <button
          type="submit"
          style={{
            justifySelf: "start",
            padding: "12px 18px",
            borderRadius: "999px",
            border: "none",
            backgroundColor: "#0f172a",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Search
        </button>
      </form>

      <section>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "24px" }}>Results</h2>
          <span style={{ color: "#64748b", fontSize: "14px" }}>
            {result.pagination.total} chunk matches
          </span>
        </div>
        {query.length === 0 ? (
          <article
            style={{
              padding: "24px",
              borderRadius: "18px",
              backgroundColor: "#f8fafc",
              border: "1px dashed #cbd5e1",
              color: "#475569",
            }}
          >
            输入问题或主题后开始搜索。
          </article>
        ) : result.items.length === 0 ? (
          <article
            style={{
              padding: "24px",
              borderRadius: "18px",
              backgroundColor: "#f8fafc",
              border: "1px dashed #cbd5e1",
              color: "#475569",
            }}
          >
            没有找到匹配的语义结果。
          </article>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {result.items.map((item) => (
              <article
                key={item.chunk.id}
                style={{
                  padding: "20px",
                  borderRadius: "18px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "baseline",
                  }}
                >
                  <a
                    href={`/assets/${item.chunk.asset.id}`}
                    style={{
                      color: "#0f172a",
                      textDecoration: "none",
                      fontSize: "18px",
                      fontWeight: 700,
                    }}
                  >
                    {item.chunk.asset.title}
                  </a>
                  <span
                    style={{
                      color: "#0f172a",
                      fontSize: "13px",
                      fontWeight: 700,
                    }}
                  >
                    score {formatScore(item.score)}
                  </span>
                </div>
                <div style={{ marginTop: "6px", color: "#64748b" }}>
                  {item.chunk.asset.type} | chunk #{item.chunk.chunkIndex} |{" "}
                  {formatDate(item.chunk.asset.createdAt)}
                </div>
                <p style={{ color: "#334155" }}>{item.chunk.textPreview}</p>
                <div style={{ color: "#64748b", fontSize: "14px" }}>
                  {item.chunk.asset.sourceUrl ??
                    `Asset ID: ${item.chunk.asset.id}`}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
