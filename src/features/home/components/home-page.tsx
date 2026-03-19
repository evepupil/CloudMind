import type { AssetSummary } from "@/features/assets/model/types";

import { PageShell } from "@/features/layout/components/page-shell";

// 这里准备首页演示数据，后续会由真实 API 或服务端查询替换。
const demoAssets: AssetSummary[] = [
  {
    id: "asset_demo_article",
    type: "url",
    title: "CloudMind Pages 全栈骨架",
    summary: "页面与 API 在一个 HonoX 项目里统一维护和部署。",
    sourceUrl: null,
    status: "ready",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "asset_demo_ingest",
    type: "note",
    title: "MVP 采集流程",
    summary: "后续会接 URL、PDF、文本与 MCP 写入。",
    sourceUrl: null,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// 这里组织首页展示卡片，突出单项目全栈与 feature-first 结构。
const featureCards = [
  {
    title: "Single Project",
    description: "用一个 HonoX 项目同时承载页面渲染与 API。",
  },
  {
    title: "Cloudflare Pages",
    description: "构建产物直接输出到 dist，便于部署到 Pages。",
  },
  {
    title: "Feature-first",
    description: "以知识库业务 feature 组织代码，而不是纯技术分层。",
  },
];

// 这里输出首页主体内容，作为项目初始化后的稳定起点。
export const HomePage = () => {
  return (
    <PageShell
      title="开源、个人可控的 AI 知识库"
      subtitle="当前已收敛为单个 HonoX 全栈项目，可直接构建并部署到 Cloudflare Pages。"
    >
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "32px",
        }}
      >
        {featureCards.map((card) => (
          <article
            key={card.title}
            style={{
              padding: "20px",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              backgroundColor: "#ffffff",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: "20px" }}>{card.title}</h2>
            <p style={{ marginBottom: 0, color: "#475569" }}>
              {card.description}
            </p>
          </article>
        ))}
      </section>

      <section>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <h2 style={{ fontSize: "24px" }}>Demo Assets</h2>
          <a
            href="/assets"
            style={{
              color: "#0f172a",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Open Real Assets
          </a>
        </div>
        <div style={{ display: "grid", gap: "12px" }}>
          {demoAssets.map((asset) => (
            <article
              key={asset.id}
              style={{
                padding: "18px 20px",
                border: "1px solid #e2e8f0",
                borderRadius: "14px",
                backgroundColor: "#f8fafc",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  alignItems: "center",
                }}
              >
                <strong>{asset.title}</strong>
                <span style={{ color: "#4f46e5", fontSize: "14px" }}>
                  {asset.status}
                </span>
              </div>
              <p style={{ marginBottom: 0, color: "#475569" }}>
                {asset.summary}
              </p>
            </article>
          ))}
        </div>
      </section>
    </PageShell>
  );
};
