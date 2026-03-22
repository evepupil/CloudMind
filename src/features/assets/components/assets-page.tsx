import type {
  AssetAiVisibility,
  AssetDocumentClass,
  AssetDomain,
  AssetListQuery,
  AssetListResult,
  AssetStatus,
  AssetSummary,
  AssetSourceKind,
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

const assetDomainOptions: Array<{ label: string; value: AssetDomain | "" }> = [
  { label: "All domains", value: "" },
  { label: "Engineering", value: "engineering" },
  { label: "Product", value: "product" },
  { label: "Research", value: "research" },
  { label: "Personal", value: "personal" },
  { label: "Finance", value: "finance" },
  { label: "Health", value: "health" },
  { label: "Archive", value: "archive" },
  { label: "General", value: "general" },
];

const assetDocumentClassOptions: Array<{
  label: string;
  value: AssetDocumentClass | "";
}> = [
  { label: "All document classes", value: "" },
  { label: "Reference Doc", value: "reference_doc" },
  { label: "Design Doc", value: "design_doc" },
  { label: "Bug Note", value: "bug_note" },
  { label: "Paper", value: "paper" },
  { label: "Journal Entry", value: "journal_entry" },
  { label: "Meeting Note", value: "meeting_note" },
  { label: "Spec", value: "spec" },
  { label: "How-to", value: "howto" },
  { label: "General Note", value: "general_note" },
];

const assetSourceKindOptions: Array<{
  label: string;
  value: AssetSourceKind | "";
}> = [
  { label: "All source kinds", value: "" },
  { label: "Manual", value: "manual" },
  { label: "Browser Extension", value: "browser_extension" },
  { label: "Upload", value: "upload" },
  { label: "MCP", value: "mcp" },
  { label: "Import", value: "import" },
];

const assetAiVisibilityOptions: Array<{
  label: string;
  value: AssetAiVisibility | "";
}> = [
  { label: "All visibility", value: "" },
  { label: "Allow", value: "allow" },
  { label: "Summary Only", value: "summary_only" },
  { label: "Deny", value: "deny" },
];

interface AssetDescriptorView {
  topics?: string[] | undefined;
}

const formatDate = (value: string): string => {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
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
      topics: Array.isArray(parsed.topics)
        ? parsed.topics.filter(
            (topic: unknown): topic is string => typeof topic === "string"
          )
        : [],
    };
  } catch {
    return null;
  }
};

const buildAssetTags = (asset: AssetSummary): string[] => {
  const descriptor = parseDescriptorJson(asset.descriptorJson);
  const tags = [
    asset.domain,
    asset.documentClass ?? null,
    asset.aiVisibility,
    asset.sourceKind,
    asset.sourceHost,
    ...(descriptor?.topics ?? []),
  ].filter((value): value is string => Boolean(value?.trim()));

  return Array.from(new Set(tags));
};

const buildFilterSummary = (filters: AssetListQuery): string => {
  const segments = [];

  if (filters.status) {
    segments.push(`status: ${filters.status}`);
  }

  if (filters.type) {
    segments.push(`type: ${filters.type}`);
  }

  if (filters.domain) {
    segments.push(`domain: ${filters.domain}`);
  }

  if (filters.documentClass) {
    segments.push(`document: ${filters.documentClass}`);
  }

  if (filters.sourceKind) {
    segments.push(`source: ${filters.sourceKind}`);
  }

  if (filters.aiVisibility) {
    segments.push(`visibility: ${filters.aiVisibility}`);
  }

  if (filters.sourceHost) {
    segments.push(`host: ${filters.sourceHost}`);
  }

  if (filters.query) {
    segments.push(`query: ${filters.query}`);
  }

  return segments.length > 0 ? segments.join(" • ") : "All assets";
};

// 这里重做 Library 页原型，让它先具备知识浏览器的结构，而不是表单堆叠页。
export const AssetsPage = ({
  items,
  pagination,
  filters,
  errorMessage,
  flashMessage,
}: {
  items: AssetSummary[];
  pagination: AssetListResult["pagination"];
  filters: AssetListQuery;
  errorMessage?: string | undefined;
  flashMessage?: string | undefined;
}) => {
  const previousPage = pagination.page > 1 ? pagination.page - 1 : null;
  const nextPage =
    pagination.page < pagination.totalPages ? pagination.page + 1 : null;
  const currentParams = new URLSearchParams();

  if (filters.status) {
    currentParams.set("status", filters.status);
  }

  if (filters.type) {
    currentParams.set("type", filters.type);
  }

  if (filters.domain) {
    currentParams.set("domain", filters.domain);
  }

  if (filters.documentClass) {
    currentParams.set("documentClass", filters.documentClass);
  }

  if (filters.sourceKind) {
    currentParams.set("sourceKind", filters.sourceKind);
  }

  if (filters.aiVisibility) {
    currentParams.set("aiVisibility", filters.aiVisibility);
  }

  if (filters.sourceHost) {
    currentParams.set("sourceHost", filters.sourceHost);
  }

  if (filters.query) {
    currentParams.set("query", filters.query);
  }

  if (filters.pageSize) {
    currentParams.set("pageSize", String(filters.pageSize));
  }

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams(currentParams);
    params.set("page", String(page));

    return `/assets?${params.toString()}`;
  };

  return (
    <PageShell
      title="Library"
      subtitle="Browse your saved knowledge as a living library. Filter by type and state, then jump into detail or keep capturing new material."
      navigationKey="library"
      actions={
        <>
          <a
            href="/capture"
            style={{
              padding: "12px 18px",
              borderRadius: "999px",
              backgroundColor: "#102033",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Capture New
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
            Ask Library
          </a>
        </>
      }
    >
      {flashMessage ? (
        <section
          style={{
            marginBottom: "18px",
            padding: "14px 16px",
            borderRadius: "16px",
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
            marginBottom: "18px",
            padding: "14px 16px",
            borderRadius: "16px",
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
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.9fr) minmax(260px, 0.45fr)",
          gap: "18px",
          marginBottom: "22px",
        }}
      >
        <article
          style={{
            padding: "22px 24px",
            borderRadius: "24px",
            backgroundColor: "#ffffff",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              color: "#0f766e",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Library Summary
          </p>
          <h2 style={{ margin: 0, fontSize: "28px" }}>
            {pagination.total} assets
          </h2>
          <p
            style={{
              margin: "10px 0 0",
              color: "#526071",
              lineHeight: 1.8,
            }}
          >
            {buildFilterSummary(filters)}
          </p>
        </article>

        <article
          style={{
            padding: "22px 24px",
            borderRadius: "24px",
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(227, 244, 242, 0.92) 100%)",
            border: "1px solid rgba(15, 23, 42, 0.08)",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "20px" }}>Use this page to</h2>
          <ul
            style={{
              margin: 0,
              paddingLeft: "18px",
              color: "#526071",
              lineHeight: 1.9,
            }}
          >
            <li>Scan recent knowledge at a glance</li>
            <li>Filter by type, domain, visibility, and source</li>
            <li>Jump to detail or keep capturing new material</li>
          </ul>
        </article>
      </section>

      <section
        style={{
          marginBottom: "20px",
          padding: "20px",
          borderRadius: "24px",
          backgroundColor: "#ffffff",
          border: "1px solid rgba(15, 23, 42, 0.08)",
          boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)",
        }}
      >
        <form
          method="get"
          action="/assets"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
          }}
        >
          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontWeight: 700 }}>Status</span>
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "14px",
                border: "1px solid rgba(15, 23, 42, 0.12)",
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
            <span style={{ fontWeight: 700 }}>Type</span>
            <select
              name="type"
              defaultValue={filters.type ?? ""}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "14px",
                border: "1px solid rgba(15, 23, 42, 0.12)",
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
            <span style={{ fontWeight: 700 }}>Domain</span>
            <select
              name="domain"
              defaultValue={filters.domain ?? ""}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "14px",
                border: "1px solid rgba(15, 23, 42, 0.12)",
                fontSize: "15px",
              }}
            >
              {assetDomainOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontWeight: 700 }}>Document Class</span>
            <select
              name="documentClass"
              defaultValue={filters.documentClass ?? ""}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "14px",
                border: "1px solid rgba(15, 23, 42, 0.12)",
                fontSize: "15px",
              }}
            >
              {assetDocumentClassOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontWeight: 700 }}>Source Kind</span>
            <select
              name="sourceKind"
              defaultValue={filters.sourceKind ?? ""}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "14px",
                border: "1px solid rgba(15, 23, 42, 0.12)",
                fontSize: "15px",
              }}
            >
              {assetSourceKindOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontWeight: 700 }}>AI Visibility</span>
            <select
              name="aiVisibility"
              defaultValue={filters.aiVisibility ?? ""}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "14px",
                border: "1px solid rgba(15, 23, 42, 0.12)",
                fontSize: "15px",
              }}
            >
              {assetAiVisibilityOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontWeight: 700 }}>Source Host</span>
            <input
              name="sourceHost"
              type="search"
              defaultValue={filters.sourceHost ?? ""}
              placeholder="developers.cloudflare.com"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "14px",
                border: "1px solid rgba(15, 23, 42, 0.12)",
                fontSize: "15px",
                boxSizing: "border-box",
              }}
            />
          </label>
          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontWeight: 700 }}>Search</span>
            <input
              name="query"
              type="search"
              defaultValue={filters.query ?? ""}
              placeholder="Title, summary, or source URL"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "14px",
                border: "1px solid rgba(15, 23, 42, 0.12)",
                fontSize: "15px",
                boxSizing: "border-box",
              }}
            />
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "end",
              gap: "10px",
              flexWrap: "wrap",
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
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Apply
            </button>
            <a
              href="/assets"
              style={{
                color: "#526071",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Reset
            </a>
          </div>
        </form>
      </section>

      {pagination.totalPages > 1 ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <span style={{ color: "#5f6e7d", fontSize: "14px" }}>
            Page {pagination.page} / {pagination.totalPages}
          </span>
          <div style={{ display: "flex", gap: "12px" }}>
            {previousPage ? (
              <a
                href={buildPageHref(previousPage)}
                style={{
                  color: "#102033",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                Previous
              </a>
            ) : (
              <span style={{ color: "#98a4b3" }}>Previous</span>
            )}
            {nextPage ? (
              <a
                href={buildPageHref(nextPage)}
                style={{
                  color: "#102033",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                Next
              </a>
            ) : (
              <span style={{ color: "#98a4b3" }}>Next</span>
            )}
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <article
          style={{
            padding: "24px",
            borderRadius: "22px",
            backgroundColor: "#ffffff",
            border: "1px dashed rgba(15, 23, 42, 0.14)",
            color: "#526071",
          }}
        >
          Your library is still empty. Start from <a href="/capture">Capture</a>{" "}
          and bring in your first URL, note, or PDF.
        </article>
      ) : (
        <div style={{ display: "grid", gap: "14px" }}>
          {items.map((asset) => (
            <article
              key={asset.id}
              style={{
                padding: "22px",
                borderRadius: "22px",
                border: "1px solid rgba(15, 23, 42, 0.08)",
                backgroundColor: "#ffffff",
                boxShadow: "0 14px 32px rgba(15, 23, 42, 0.06)",
              }}
            >
              {buildAssetTags(asset).length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                    marginBottom: "12px",
                  }}
                >
                  {buildAssetTags(asset).map((tag) => (
                    <span
                      key={`${asset.id}:${tag}`}
                      style={{
                        padding: "5px 8px",
                        borderRadius: "999px",
                        backgroundColor: "#f4f7fb",
                        color: "#4b5a6b",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      {formatLabel(tag)}
                    </span>
                  ))}
                </div>
              ) : null}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "14px",
                  marginBottom: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <a
                    href={`/assets/${asset.id}`}
                    style={{
                      color: "#102033",
                      textDecoration: "none",
                      fontSize: "18px",
                      fontWeight: 800,
                    }}
                  >
                    {asset.title}
                  </a>
                  <div style={{ marginTop: "6px", color: "#5f6e7d" }}>
                    {asset.type} • Created {formatDate(asset.createdAt)}
                  </div>
                </div>
                <AssetStatusBadge status={asset.status} />
              </div>
              <p
                style={{
                  marginTop: 0,
                  marginBottom: "10px",
                  color: "#445160",
                  lineHeight: 1.8,
                }}
              >
                {asset.summary ??
                  "Summary has not been generated yet. This record is currently showing raw metadata."}
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ color: "#5f6e7d", fontSize: "14px" }}>
                  {asset.sourceHost ??
                    asset.sourceUrl ??
                    `Asset ID: ${asset.id}`}
                </div>
                <div style={{ display: "flex", gap: "14px" }}>
                  <a
                    href={`/assets/${asset.id}`}
                    style={{
                      color: "#102033",
                      textDecoration: "none",
                      fontWeight: 700,
                    }}
                  >
                    Open Detail
                  </a>
                  <a
                    href="/ask"
                    style={{
                      color: "#0f766e",
                      textDecoration: "none",
                      fontWeight: 700,
                    }}
                  >
                    Ask From Here
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
};
