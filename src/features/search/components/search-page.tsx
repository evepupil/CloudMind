import type { AssetListResult } from "@/features/assets/model/types";
import { PageShell } from "@/features/layout/components/page-shell";

const formatDate = (value: string): string => {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
};

export const SearchPage = ({
  result,
  query,
}: {
  result: AssetListResult;
  query: string;
}) => {
  return (
    <PageShell
      title="Search"
      subtitle="先用标题、摘要和来源 URL 的关键词检索，后续再接语义搜索。"
    >
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
          <span style={{ fontWeight: 700 }}>Keyword Query</span>
          <input
            name="query"
            type="search"
            defaultValue={query}
            placeholder="Search title, summary, or source URL"
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
            {result.pagination.total} matches
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
            输入关键词后开始搜索。
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
            没有找到匹配结果。
          </article>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {result.items.map((asset) => (
              <article
                key={asset.id}
                style={{
                  padding: "20px",
                  borderRadius: "18px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                }}
              >
                <a
                  href={`/assets/${asset.id}`}
                  style={{
                    color: "#0f172a",
                    textDecoration: "none",
                    fontSize: "18px",
                    fontWeight: 700,
                  }}
                >
                  {asset.title}
                </a>
                <div style={{ marginTop: "6px", color: "#64748b" }}>
                  {asset.type} · {formatDate(asset.createdAt)}
                </div>
                <p style={{ color: "#334155" }}>
                  {asset.summary ?? "暂无摘要，当前只匹配到了元数据。"}
                </p>
                <div style={{ color: "#64748b", fontSize: "14px" }}>
                  {asset.sourceUrl ?? `Asset ID: ${asset.id}`}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
};
