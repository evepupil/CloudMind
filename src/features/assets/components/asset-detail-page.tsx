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
        marginBottom: "18px",
        padding: "14px 16px",
        borderRadius: "16px",
        ...styles,
      }}
    >
      {children}
    </section>
  );
};

// 这里重做详情页原型，让它更像知识档案页而不是字段回显页。
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
        title="Asset detail"
        subtitle="Review source, processed content, and job history for a single knowledge asset."
        navigationKey="library"
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
      subtitle="Read the cleaned content, inspect the source record, and trace processing history without leaving the workspace."
      navigationKey="library"
      actions={
        <>
          <a
            href="/assets"
            style={{
              padding: "12px 18px",
              borderRadius: "999px",
              backgroundColor: "#eef2f7",
              color: "#102033",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Back to Library
          </a>
          <a
            href="/ask"
            style={{
              padding: "12px 18px",
              borderRadius: "999px",
              backgroundColor: "#dff7f5",
              color: "#0f766e",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Ask About This
          </a>
        </>
      }
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
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.75fr)",
          gap: "18px",
        }}
      >
        <div style={{ display: "grid", gap: "18px" }}>
          <article
            style={{
              padding: "24px",
              borderRadius: "24px",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              backgroundColor: "#ffffff",
              boxShadow: "0 18px 48px rgba(15, 23, 42, 0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
                marginBottom: "16px",
              }}
            >
              <div style={{ color: "#5f6e7d" }}>
                {item.type} • Created {formatDate(item.createdAt)}
              </div>
              <AssetStatusBadge status={item.status} />
            </div>
            <h2 style={{ marginTop: 0, fontSize: "22px" }}>Summary</h2>
            <p style={{ marginBottom: 0, color: "#445160", lineHeight: 1.85 }}>
              {item.summary ?? "Summary has not been generated yet."}
            </p>
          </article>

          <article
            style={{
              padding: "24px",
              borderRadius: "24px",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              backgroundColor: "#ffffff",
              boxShadow: "0 18px 48px rgba(15, 23, 42, 0.08)",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: "22px" }}>Content</h2>
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily:
                  '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
                color: "#102033",
                lineHeight: 1.8,
              }}
            >
              {item.contentText ?? "Content has not been stored yet."}
            </pre>
          </article>

          <article
            style={{
              padding: "24px",
              borderRadius: "24px",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              backgroundColor: "#ffffff",
              boxShadow: "0 18px 48px rgba(15, 23, 42, 0.08)",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: "22px" }}>Chunks</h2>
            {item.chunks.length === 0 ? (
              <p style={{ marginBottom: 0, color: "#5f6e7d" }}>
                No chunk records yet.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {item.chunks.map((chunk) => (
                  <article
                    key={chunk.id}
                    style={{
                      padding: "16px",
                      borderRadius: "18px",
                      backgroundColor: "#f8fbfc",
                      border: "1px solid rgba(15, 23, 42, 0.06)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        color: "#102033",
                        fontWeight: 700,
                        marginBottom: "8px",
                      }}
                    >
                      <span>Chunk #{chunk.chunkIndex}</span>
                      <span>{chunk.vectorId ?? "No vector"}</span>
                    </div>
                    <p style={{ margin: 0, color: "#445160", lineHeight: 1.7 }}>
                      {chunk.textPreview}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>

        <aside style={{ display: "grid", gap: "18px" }}>
          <article
            style={{
              padding: "22px",
              borderRadius: "24px",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              backgroundColor: "#ffffff",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: "20px" }}>Source</h2>
            <dl
              style={{
                display: "grid",
                gap: "12px",
                margin: 0,
              }}
            >
              <div>
                <dt style={{ color: "#5f6e7d" }}>Kind</dt>
                <dd style={{ margin: "6px 0 0" }}>
                  {item.source?.kind ?? "No source record yet."}
                </dd>
              </div>
              <div>
                <dt style={{ color: "#5f6e7d" }}>URL</dt>
                <dd style={{ margin: "6px 0 0", wordBreak: "break-word" }}>
                  {item.source?.sourceUrl ?? item.sourceUrl ?? "N/A"}
                </dd>
              </div>
              <div>
                <dt style={{ color: "#5f6e7d" }}>Raw R2 Key</dt>
                <dd style={{ margin: "6px 0 0", wordBreak: "break-word" }}>
                  {item.rawR2Key ?? "N/A"}
                </dd>
              </div>
            </dl>
          </article>

          <article
            style={{
              padding: "22px",
              borderRadius: "24px",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(232, 250, 244, 0.9) 100%)",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: "20px" }}>Processing</h2>
            <div style={{ display: "grid", gap: "10px" }}>
              <div style={{ color: "#5f6e7d" }}>
                Updated: {formatDate(item.updatedAt)}
              </div>
              <div style={{ color: "#5f6e7d" }}>
                Processed: {formatDate(item.processedAt)}
              </div>
              <div style={{ color: "#5f6e7d" }}>
                MIME: {item.mimeType ?? "N/A"}
              </div>
              <div style={{ color: "#5f6e7d" }}>
                Language: {item.language ?? "N/A"}
              </div>
              {isReprocessable ? (
                <form
                  action={`/assets/actions/${item.id}/process`}
                  method="post"
                >
                  <button
                    type="submit"
                    style={{
                      marginTop: "8px",
                      padding: "12px 16px",
                      borderRadius: "999px",
                      border: "none",
                      backgroundColor: "#102033",
                      color: "#ffffff",
                      fontSize: "14px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Reprocess Asset
                  </button>
                </form>
              ) : null}
            </div>
          </article>

          <article
            style={{
              padding: "22px",
              borderRadius: "24px",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              backgroundColor: "#ffffff",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: "20px" }}>Jobs</h2>
            {item.jobs.length === 0 ? (
              <p style={{ marginBottom: 0, color: "#5f6e7d" }}>
                No job records yet.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {item.jobs.map((job) => (
                  <article
                    key={job.id}
                    style={{
                      padding: "14px 16px",
                      borderRadius: "16px",
                      backgroundColor: "#f8fbfc",
                      border: "1px solid rgba(15, 23, 42, 0.06)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        color: "#102033",
                        fontWeight: 700,
                      }}
                    >
                      <span>{job.jobType}</span>
                      <span>{job.status}</span>
                    </div>
                    <div style={{ marginTop: "8px", color: "#5f6e7d" }}>
                      attempt {job.attempt} • {formatDate(job.createdAt)}
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
          </article>
        </aside>
      </section>
    </PageShell>
  );
};
