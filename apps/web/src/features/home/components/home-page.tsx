import type { AssetSummary } from "@cloudmind/shared";

import { PageShell } from "@/features/layout/components/page-shell";

// 这里准备首页展示用的演示资产，后续会切换为真实 API 数据。
const demoAssets: AssetSummary[] = [
  {
    id: "asset_demo_article",
    type: "url",
    title: "CloudMind MVP 架构草图",
    summary: "基于 Hono、HonoX 与 Cloudflare 全家桶的快速原型方案。",
    status: "ready",
    createdAt: new Date().toISOString(),
  },
  {
    id: "asset_demo_chat",
    type: "chat",
    title: "AI 对话存档示例",
    summary: "重要对话可直接写入知识库并在后续语义检索中复用。",
    status: "processing",
    createdAt: new Date().toISOString(),
  },
];

// 这里组织首页信息结构，突出前后端分离与 feature 化约束。
const featureCards = [
  {
    title: "Frontend · HonoX",
    description: "负责后台页面、搜索视图与资产详情等 SSR 界面。",
  },
  {
    title: "Backend · Hono",
    description: "负责 API、MCP 与后续 Cloudflare Worker 绑定接入。",
  },
  {
    title: "Feature-first",
    description: "按业务 feature 切目录，避免只按技术层散落文件。",
  },
];

// 这里输出首页主体内容，先提供一个稳定的演示界面。
export const HomePage = () => {
  return (
    <PageShell
      title="开源、个人可控的 AI 知识库"
      subtitle="当前已初始化为前后端分离的 TypeScript monorepo，默认面向 Cloudflare 快速原型。"
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
        <h2 style={{ fontSize: "24px" }}>Demo Assets</h2>
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
