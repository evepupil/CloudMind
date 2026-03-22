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

interface AssetDescriptorView {
  assetType?: string | null | undefined;
  sourceKind?: string | null | undefined;
  domain?: string | null | undefined;
  documentClass?: string | null | undefined;
  topics?: string[] | undefined;
  collectionKey?: string | null | undefined;
  capturedAt?: string | null | undefined;
  sourceHost?: string | null | undefined;
  language?: string | null | undefined;
  mimeType?: string | null | undefined;
  signals?: string[] | undefined;
}

const parseDescriptorJson = (
  descriptorJson: string | null
): AssetDescriptorView | null => {
  if (!descriptorJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(descriptorJson);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      assetType: typeof parsed.assetType === "string" ? parsed.assetType : null,
      sourceKind:
        typeof parsed.sourceKind === "string" ? parsed.sourceKind : null,
      domain: typeof parsed.domain === "string" ? parsed.domain : null,
      documentClass:
        typeof parsed.documentClass === "string" ? parsed.documentClass : null,
      topics: Array.isArray(parsed.topics)
        ? parsed.topics.filter(
            (topic: unknown): topic is string => typeof topic === "string"
          )
        : [],
      collectionKey:
        typeof parsed.collectionKey === "string" ? parsed.collectionKey : null,
      capturedAt:
        typeof parsed.capturedAt === "string" ? parsed.capturedAt : null,
      sourceHost:
        typeof parsed.sourceHost === "string" ? parsed.sourceHost : null,
      language: typeof parsed.language === "string" ? parsed.language : null,
      mimeType: typeof parsed.mimeType === "string" ? parsed.mimeType : null,
      signals: Array.isArray(parsed.signals)
        ? parsed.signals.filter(
            (signal: unknown): signal is string => typeof signal === "string"
          )
        : [],
    };
  } catch {
    return null;
  }
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
  const descriptor = parseDescriptorJson(item.descriptorJson);

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
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                marginTop: "16px",
              }}
            >
              {[
                item.domain,
                item.documentClass ?? null,
                item.aiVisibility,
                item.sourceKind,
                item.sourceHost,
              ]
                .filter((value): value is string => Boolean(value?.trim()))
                .map((value) => (
                  <span
                    key={value}
                    style={{
                      padding: "6px 9px",
                      borderRadius: "999px",
                      backgroundColor: "#f4f7fb",
                      color: "#445160",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {formatLabel(value)}
                  </span>
                ))}
            </div>
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
            <h2 style={{ marginTop: 0, fontSize: "22px" }}>Layered Index</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                marginBottom: "18px",
              }}
            >
              {[
                {
                  label: "Domain",
                  value: item.domain,
                },
                {
                  label: "Document Class",
                  value: item.documentClass ?? descriptor?.documentClass ?? "N/A",
                },
                {
                  label: "Source Host",
                  value: item.sourceHost ?? descriptor?.sourceHost ?? "N/A",
                },
                {
                  label: "Collection",
                  value: item.collectionKey ?? descriptor?.collectionKey ?? "N/A",
                },
                {
                  label: "AI Visibility",
                  value: item.aiVisibility,
                },
                {
                  label: "Sensitivity",
                  value: item.sensitivity,
                },
              ].map((entry) => (
                <div
                  key={entry.label}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "18px",
                    backgroundColor: "#f8fbfc",
                    border: "1px solid rgba(15, 23, 42, 0.06)",
                  }}
                >
                  <div
                    style={{
                      color: "#5f6e7d",
                      fontSize: "12px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {entry.label}
                  </div>
                  <div
                    style={{
                      marginTop: "8px",
                      color: "#102033",
                      fontWeight: 700,
                      wordBreak: "break-word",
                    }}
                  >
                    {entry.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gap: "14px" }}>
              <div>
                <h3 style={{ margin: "0 0 10px", fontSize: "16px" }}>Topics</h3>
                {descriptor?.topics?.length ? (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {descriptor.topics.map((topic) => (
                      <span
                        key={topic}
                        style={{
                          padding: "6px 9px",
                          borderRadius: "999px",
                          backgroundColor: "#eef6ff",
                          color: "#0b5cab",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        {formatLabel(topic)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, color: "#5f6e7d" }}>
                    No topic signals yet.
                  </p>
                )}
              </div>

              <div>
                <h3 style={{ margin: "0 0 10px", fontSize: "16px" }}>Facets</h3>
                {item.facets?.length ? (
                  <div style={{ display: "grid", gap: "10px" }}>
                    {item.facets.map((facet) => (
                      <div
                        key={facet.id}
                        style={{
                          padding: "14px 16px",
                          borderRadius: "16px",
                          backgroundColor: "#faf8f4",
                          border: "1px solid rgba(15, 23, 42, 0.06)",
                        }}
                      >
                        <div
                          style={{
                            color: "#8b6c35",
                            fontSize: "12px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                          }}
                        >
                          {formatLabel(facet.facetKey)}
                        </div>
                        <div
                          style={{
                            marginTop: "6px",
                            color: "#102033",
                            fontWeight: 700,
                          }}
                        >
                          {facet.facetLabel}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, color: "#5f6e7d" }}>
                    No facet records yet.
                  </p>
                )}
              </div>
            </div>
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

          <article
            style={{
              padding: "24px",
              borderRadius: "24px",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              backgroundColor: "#ffffff",
              boxShadow: "0 18px 48px rgba(15, 23, 42, 0.08)",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: "22px" }}>Assertions</h2>
            {item.assertions?.length ? (
              <div style={{ display: "grid", gap: "12px" }}>
                {item.assertions.map((assertion) => (
                  <article
                    key={assertion.id}
                    style={{
                      padding: "16px",
                      borderRadius: "18px",
                      backgroundColor: "#fffdf7",
                      border: "1px solid rgba(15, 23, 42, 0.06)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        flexWrap: "wrap",
                        marginBottom: "8px",
                      }}
                    >
                      <span
                        style={{
                          color: "#8b6c35",
                          fontSize: "12px",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {formatLabel(assertion.kind)}
                      </span>
                      <span style={{ color: "#5f6e7d", fontSize: "13px" }}>
                        Confidence:{" "}
                        {typeof assertion.confidence === "number"
                          ? assertion.confidence.toFixed(2)
                          : "N/A"}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: "#445160", lineHeight: 1.8 }}>
                      {assertion.text}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p style={{ marginBottom: 0, color: "#5f6e7d" }}>
                No assertion records yet.
              </p>
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
            <h2 style={{ marginTop: 0, fontSize: "20px" }}>Manage</h2>
            <form
              action={`/assets/actions/${item.id}/update`}
              method="post"
              style={{ display: "grid", gap: "12px" }}
            >
              <label style={{ display: "grid", gap: "8px" }}>
                <span style={{ fontWeight: 700 }}>Title</span>
                <input
                  name="title"
                  defaultValue={item.title}
                  required
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "14px",
                    border: "1px solid rgba(15, 23, 42, 0.12)",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: "8px" }}>
                <span style={{ fontWeight: 700 }}>Source URL</span>
                <input
                  name="sourceUrl"
                  type="url"
                  defaultValue={item.sourceUrl ?? ""}
                  placeholder="https://example.com"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "14px",
                    border: "1px solid rgba(15, 23, 42, 0.12)",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: "8px" }}>
                <span style={{ fontWeight: 700 }}>Summary</span>
                <textarea
                  name="summary"
                  defaultValue={item.summary ?? ""}
                  rows={5}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "14px",
                    border: "1px solid rgba(15, 23, 42, 0.12)",
                    fontSize: "14px",
                    lineHeight: 1.7,
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />
              </label>
              <button
                type="submit"
                style={{
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
                Save Changes
              </button>
            </form>
            <form
              action={`/assets/actions/${item.id}/delete`}
              method="post"
              style={{ marginTop: "14px" }}
            >
              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "999px",
                  border: "1px solid #fecaca",
                  backgroundColor: "#fff1f2",
                  color: "#b91c1c",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Delete Asset
              </button>
            </form>
            <p
              style={{
                marginBottom: 0,
                color: "#7f1d1d",
                fontSize: "13px",
                lineHeight: 1.7,
              }}
            >
              Deletion is soft-delete for now. The asset disappears from list,
              search, and chat results.
            </p>
          </article>

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
