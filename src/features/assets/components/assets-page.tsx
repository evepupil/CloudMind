import type {
  AssetListQuery,
  AssetStatus,
  AssetSummary,
  AssetType,
} from "@/features/assets/model/types";
import { PageShell } from "@/features/layout/components/page-shell";

import { AssetStatusBadge } from "./asset-status-badge";

const assetStatusOptions: Array<{ label: string; value: AssetStatus | "" }> = [
  { label: "All status", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "Ready", value: "ready" },
  { label: "Failed", value: "failed" },
];

const assetTypeOptions: Array<{ label: string; value: AssetType | "" }> = [
  { label: "All types", value: "" },
  { label: "URL", value: "url" },
  { label: "PDF", value: "pdf" },
  { label: "Note", value: "note" },
  { label: "Image", value: "image" },
  { label: "Chat", value: "chat" },
];

const formatDate = (value: string): string => {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
};

// 这里提供资产列表页，先覆盖文本资产写入和资产状态查看两个 MVP 场景。
export const AssetsPage = ({
  items,
  filters,
  errorMessage,
  flashMessage,
}: {
  items: AssetSummary[];
  filters: AssetListQuery;
  errorMessage?: string | undefined;
  flashMessage?: string | undefined;
}) => {
  return (
    <PageShell
      title="Assets"
      subtitle="用 D1 持久化资产元数据，先把文本采集、列表和状态展示跑通。"
    >
      {flashMessage ? (
        <section
          style={{
            marginBottom: "24px",
            padding: "14px 16px",
            borderRadius: "14px",
            backgroundColor: "#ecfeff",
            border: "1px solid #a5f3fc",
            color: "#155e75",
          }}
        >
          {flashMessage}
        </section>
      ) : null}

      {errorMessage ? (
        <section
          style={{
            marginBottom: "24px",
            padding: "14px 16px",
            borderRadius: "14px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
          }}
        >
          {errorMessage}
        </section>
      ) : null}

      <section
        style={{
          marginBottom: "32px",
          padding: "24px",
          border: "1px solid #e2e8f0",
          borderRadius: "20px",
          background:
            "linear-gradient(135deg, #f8fafc 0%, #eef2ff 55%, #ecfeff 100%)",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "24px" }}>
          Save Text Asset
        </h2>
        <p style={{ marginTop: 0, marginBottom: "20px", color: "#475569" }}>
          第一版直接通过表单提交文本资产，落库后会生成一条 queued job。
        </p>
        <form
          action="/assets/actions/ingest-text"
          method="post"
          style={{ display: "grid", gap: "14px" }}
        >
          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontWeight: 600 }}>Title</span>
            <input
              name="title"
              type="text"
              placeholder="Weekly research notes"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                fontSize: "15px",
              }}
            />
          </label>
          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontWeight: 600 }}>Content</span>
            <textarea
              name="content"
              placeholder="Paste notes, article excerpts, or chat summaries here."
              rows={8}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                fontSize: "15px",
                resize: "vertical",
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
            Save Asset
          </button>
        </form>
      </section>

      <section
        style={{
          marginBottom: "32px",
          padding: "24px",
          border: "1px solid #e2e8f0",
          borderRadius: "20px",
          backgroundColor: "#ffffff",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "24px" }}>
          Save URL Asset
        </h2>
        <form
          action="/assets/actions/ingest-url"
          method="post"
          style={{ display: "grid", gap: "14px" }}
        >
          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontWeight: 600 }}>Title</span>
            <input
              name="title"
              type="text"
              placeholder="Optional title"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                fontSize: "15px",
              }}
            />
          </label>
          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontWeight: 600 }}>URL</span>
            <input
              name="url"
              type="url"
              placeholder="https://example.com/article"
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
              backgroundColor: "#0f766e",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Save URL
          </button>
        </form>
      </section>

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
          <h2 style={{ margin: 0, fontSize: "24px" }}>Asset Library</h2>
          <span style={{ color: "#64748b", fontSize: "14px" }}>
            {items.length} assets
          </span>
        </div>
        <form
          method="get"
          action="/assets"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            marginBottom: "18px",
            padding: "18px",
            borderRadius: "18px",
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        >
          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontWeight: 600 }}>Status</span>
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                fontSize: "15px",
              }}
            >
              {assetStatusOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontWeight: 600 }}>Type</span>
            <select
              name="type"
              defaultValue={filters.type ?? ""}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                fontSize: "15px",
              }}
            >
              {assetTypeOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontWeight: 600 }}>Search</span>
            <input
              name="query"
              type="search"
              defaultValue={filters.query ?? ""}
              placeholder="Title, summary, or URL"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                fontSize: "15px",
              }}
            />
          </label>
          <div style={{ display: "flex", alignItems: "end", gap: "10px" }}>
            <button
              type="submit"
              style={{
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
              Apply Filters
            </button>
            <a
              href="/assets"
              style={{
                color: "#475569",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Reset
            </a>
          </div>
        </form>
        {items.length === 0 ? (
          <article
            style={{
              padding: "24px",
              borderRadius: "18px",
              backgroundColor: "#f8fafc",
              border: "1px dashed #cbd5e1",
              color: "#475569",
            }}
          >
            还没有资产。先提交一条文本内容，把第一条记录写进 D1。
          </article>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {items.map((asset) => (
              <article
                key={asset.id}
                style={{
                  padding: "20px",
                  borderRadius: "18px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "14px",
                    marginBottom: "12px",
                  }}
                >
                  <div>
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
                      {asset.type} · 创建于 {formatDate(asset.createdAt)}
                    </div>
                  </div>
                  <AssetStatusBadge status={asset.status} />
                </div>
                <p
                  style={{
                    marginTop: 0,
                    marginBottom: "10px",
                    color: "#334155",
                  }}
                >
                  {asset.summary ?? "摘要尚未生成，当前展示原始元数据。"}
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
