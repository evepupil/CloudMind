import type { AssetDetail } from "@/features/assets/model/types";
import { PageShell } from "@/features/layout/components/page-shell";

import { AssetStatusBadge } from "./asset-status-badge";

const formatDate = (value: string | null): string => {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
};

// 这里提供最小资产详情页，用于确认写入 D1 的记录、来源和任务状态。
export const AssetDetailPage = ({
  item,
  errorMessage,
}: {
  item?: AssetDetail | undefined;
  errorMessage?: string | undefined;
}) => {
  if (!item) {
    return (
      <PageShell
        title="Asset Detail"
        subtitle="查看单个资产的元数据、正文与处理任务状态。"
      >
        <section
          style={{
            padding: "20px",
            borderRadius: "18px",
            border: "1px solid #fecaca",
            backgroundColor: "#fef2f2",
            color: "#991b1b",
          }}
        >
          {errorMessage ?? "Asset not found."}
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={item.title}
      subtitle="第一版详情页先覆盖正文、来源和任务列表，方便验证 ingest 闭环。"
    >
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
          }}
        >
          <div style={{ color: "#64748b" }}>
            {item.type} · 创建于 {formatDate(item.createdAt)}
          </div>
          <AssetStatusBadge status={item.status} />
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
          {item.summary ?? "摘要尚未生成。"}
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
          {item.contentText ?? "正文尚未写入。"}
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
        <h2 style={{ marginTop: 0 }}>Source</h2>
        <p style={{ color: "#334155" }}>
          {item.source
            ? `${item.source.kind} · ${item.source.sourceUrl ?? "No URL"}`
            : "暂无来源记录。"}
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
          <p style={{ marginBottom: 0, color: "#64748b" }}>暂无任务记录。</p>
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
