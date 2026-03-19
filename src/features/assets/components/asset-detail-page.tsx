import type { AssetDetail, AssetType } from "@/features/assets/model/types";
import { PageShell } from "@/features/layout/components/page-shell";

import { AssetStatusBadge } from "./asset-status-badge";

const reprocessableAssetTypes: AssetType[] = ["note", "chat", "url", "pdf"];

const formatDate = (value: string | null): string => {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
};

const canReprocessAsset = (type: AssetType): boolean => {
  return reprocessableAssetTypes.includes(type);
};

const MessageBanner = ({
  children,
  tone,
}: {
  children: string;
  tone: "success" | "error";
}) => {
  const styles =
    tone === "success"
      ? {
          backgroundColor: "#ecfeff",
          border: "1px solid #a5f3fc",
          color: "#155e75",
        }
      : {
          backgroundColor: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#991b1b",
        };

  return (
    <section
      style={{
        marginBottom: "24px",
        padding: "14px 16px",
        borderRadius: "14px",
        ...styles,
      }}
    >
      {children}
    </section>
  );
};

// 这里提供最小资产详情页，覆盖正文、来源、任务记录和手动重处理入口。
export const AssetDetailPage = ({
  item,
  errorMessage,
  flashMessage,
}: {
  item?: AssetDetail | undefined;
  errorMessage?: string | undefined;
  flashMessage?: string | undefined;
}) => {
  if (!item) {
    return (
      <PageShell
        title="Asset Detail"
        subtitle="查看单个资产的元数据、正文和处理任务状态。"
      >
        <MessageBanner tone="error">
          {errorMessage ?? "Asset not found."}
        </MessageBanner>
      </PageShell>
    );
  }

  const isReprocessable = canReprocessAsset(item.type);

  return (
    <PageShell
      title={item.title}
      subtitle="第一版详情页先覆盖正文、来源和任务列表，方便验证 ingest 闭环。"
    >
      {flashMessage ? (
        <MessageBanner tone="success">{flashMessage}</MessageBanner>
      ) : null}

      {errorMessage ? (
        <MessageBanner tone="error">{errorMessage}</MessageBanner>
      ) : null}

      <section
        style={{
          display: "grid",
          gap: "14px",
          marginBottom: "28px",
          padding: "24px",
          borderRadius: "20px",
          border: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ color: "#64748b" }}>
            {item.type} · Created at {formatDate(item.createdAt)}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <AssetStatusBadge status={item.status} />
            {isReprocessable ? (
              <form action={`/assets/actions/${item.id}/process`} method="post">
                <button
                  type="submit"
                  style={{
                    padding: "10px 16px",
                    borderRadius: "999px",
                    border: "none",
                    backgroundColor: "#0f172a",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Reprocess Asset
                </button>
              </form>
            ) : (
              <span style={{ color: "#94a3b8", fontSize: "14px" }}>
                Reprocess is not available for this asset type yet.
              </span>
            )}
          </div>
        </div>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
            margin: 0,
          }}
        >
          <div>
            <dt style={{ color: "#64748b" }}>Updated At</dt>
            <dd style={{ margin: "6px 0 0" }}>{formatDate(item.updatedAt)}</dd>
          </div>
          <div>
            <dt style={{ color: "#64748b" }}>Processed At</dt>
            <dd style={{ margin: "6px 0 0" }}>
              {formatDate(item.processedAt)}
            </dd>
          </div>
          <div>
            <dt style={{ color: "#64748b" }}>MIME Type</dt>
            <dd style={{ margin: "6px 0 0" }}>{item.mimeType ?? "N/A"}</dd>
          </div>
          <div>
            <dt style={{ color: "#64748b" }}>Language</dt>
            <dd style={{ margin: "6px 0 0" }}>{item.language ?? "N/A"}</dd>
          </div>
          <div>
            <dt style={{ color: "#64748b" }}>Content R2 Key</dt>
            <dd style={{ margin: "6px 0 0" }}>{item.contentR2Key ?? "N/A"}</dd>
          </div>
        </dl>
      </section>

      <section
        style={{
          marginBottom: "28px",
          padding: "24px",
          borderRadius: "20px",
          border: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Summary</h2>
        <p style={{ marginBottom: 0, color: "#334155" }}>
          {item.summary ?? "Summary has not been generated yet."}
        </p>
      </section>

      <section
        style={{
          marginBottom: "28px",
          padding: "24px",
          borderRadius: "20px",
          border: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Content</h2>
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily:
              '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
            color: "#0f172a",
          }}
        >
          {item.contentText ?? "Content has not been stored yet."}
        </pre>
      </section>

      <section
        style={{
          marginBottom: "28px",
          padding: "24px",
          borderRadius: "20px",
          border: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Chunks</h2>
        {item.chunks.length === 0 ? (
          <p style={{ marginBottom: 0, color: "#64748b" }}>
            No chunk records yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {item.chunks.map((chunk) => (
              <article
                key={chunk.id}
                style={{
                  padding: "16px",
                  borderRadius: "16px",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    color: "#0f172a",
                    fontWeight: 700,
                    marginBottom: "8px",
                  }}
                >
                  <span>Chunk #{chunk.chunkIndex}</span>
                  <span>{chunk.vectorId ?? "No vector"}</span>
                </div>
                <p style={{ margin: 0, color: "#334155" }}>
                  {chunk.textPreview}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        style={{
          marginBottom: "28px",
          padding: "24px",
          borderRadius: "20px",
          border: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Source</h2>
        <p style={{ color: "#334155", marginBottom: 0 }}>
          {item.source
            ? `${item.source.kind} · ${item.source.sourceUrl ?? "No URL"}`
            : "No source record yet."}
        </p>
      </section>

      <section
        style={{
          padding: "24px",
          borderRadius: "20px",
          border: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Jobs</h2>
        {item.jobs.length === 0 ? (
          <p style={{ marginBottom: 0, color: "#64748b" }}>
            No job records yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {item.jobs.map((job) => (
              <article
                key={job.id}
                style={{
                  padding: "16px",
                  borderRadius: "16px",
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    color: "#0f172a",
                    fontWeight: 700,
                  }}
                >
                  <span>{job.jobType}</span>
                  <span>{job.status}</span>
                </div>
                <div style={{ marginTop: "8px", color: "#64748b" }}>
                  attempt {job.attempt} · {formatDate(job.createdAt)}
                </div>
                {job.errorMessage ? (
                  <p style={{ marginBottom: 0, color: "#b91c1c" }}>
                    {job.errorMessage}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
};
