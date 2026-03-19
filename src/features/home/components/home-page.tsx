import type { AssetSummary } from "@/features/assets/model/types";

import { PageShell } from "@/features/layout/components/page-shell";

const demoAssets: AssetSummary[] = [
  {
    id: "asset_demo_article",
    type: "url",
    title: "CloudMind Pages 全栈原型",
    summary:
      "页面、API 和知识库工作流放在同一个 HonoX 项目中，便于快速验证 MVP。",
    sourceUrl: null,
    status: "ready",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "asset_demo_ingest",
    type: "note",
    title: "知识采集闭环",
    summary:
      "优先打通文本、URL、PDF 的收集、处理、搜索和后续提问，而不是先做复杂功能。",
    sourceUrl: null,
    status: "processing",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "asset_demo_question",
    type: "chat",
    title: "Ask Library 体验方向",
    summary: "回答应该始终带来源证据，让知识问答具备可追溯性和可信度。",
    sourceUrl: null,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const featureCards = [
  {
    title: "Overview First",
    description:
      "首页展示知识库脉搏，而不是一堆孤立入口。用户进入后先知道发生了什么。",
  },
  {
    title: "Library as Workspace",
    description:
      "资产页是知识浏览器，不只是后台列表。浏览、筛选和进入详情应当顺畅。",
  },
  {
    title: "Ask with Evidence",
    description:
      "问答页需要把回答和证据绑定起来，让 CloudMind 更像个人研究台。",
  },
];

const metricCards = [
  {
    label: "New in 24h",
    value: "12",
    tone: "#0f766e",
  },
  {
    label: "Processing",
    value: "3",
    tone: "#1d4ed8",
  },
  {
    label: "Failed",
    value: "1",
    tone: "#b45309",
  },
];

const statusStyles: Record<
  AssetSummary["status"],
  { color: string; bg: string }
> = {
  pending: {
    color: "#92400e",
    bg: "#fef3c7",
  },
  processing: {
    color: "#1d4ed8",
    bg: "#dbeafe",
  },
  ready: {
    color: "#0f766e",
    bg: "#ccfbf1",
  },
  failed: {
    color: "#b91c1c",
    bg: "#fee2e2",
  },
};

// 这里重做首页原型，让它更像知识工作台的总览，而不是简单功能展示页。
export const HomePage = () => {
  return (
    <PageShell
      title="Your private knowledge workspace"
      subtitle="Capture webpages, notes, PDFs, and future AI conversations into one calm, searchable library you control."
      navigationKey="overview"
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
            Open Capture
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
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        {metricCards.map((card) => (
          <article
            key={card.label}
            style={{
              padding: "18px 20px",
              borderRadius: "22px",
              backgroundColor: "#ffffff",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              boxShadow: "0 16px 40px rgba(15, 23, 42, 0.07)",
            }}
          >
            <p
              style={{
                margin: "0 0 10px",
                color: "#5f6e7d",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {card.label}
            </p>
            <p
              style={{
                margin: 0,
                color: card.tone,
                fontSize: "34px",
                fontWeight: 800,
              }}
            >
              {card.value}
            </p>
          </article>
        ))}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.45fr) minmax(300px, 0.95fr)",
          gap: "18px",
          marginBottom: "28px",
        }}
      >
        <article
          style={{
            padding: "26px",
            borderRadius: "28px",
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(233, 245, 249, 0.92) 100%)",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            boxShadow: "0 18px 48px rgba(15, 23, 42, 0.08)",
          }}
        >
          <p
            style={{
              margin: "0 0 12px",
              color: "#0f766e",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontSize: "12px",
            }}
          >
            Overview
          </p>
          <h2
            style={{
              margin: 0,
              fontSize: "30px",
              lineHeight: 1.12,
              fontFamily: '"Georgia", "Palatino Linotype", serif',
            }}
          >
            Treat CloudMind like a research desk, not a storage bucket.
          </h2>
          <p
            style={{
              margin: "14px 0 0",
              color: "#526071",
              lineHeight: 1.8,
              fontSize: "16px",
            }}
          >
            Your homepage should surface what just entered the library, what is
            still processing, what failed, and what you can ask next.
          </p>
        </article>

        <article
          style={{
            padding: "24px",
            borderRadius: "28px",
            backgroundColor: "#ffffff",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            boxShadow: "0 18px 48px rgba(15, 23, 42, 0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "22px" }}>Quick Routes</h2>
            <a
              href="/assets"
              style={{
                color: "#102033",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Open library
            </a>
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            {featureCards.map((card) => (
              <article
                key={card.title}
                style={{
                  padding: "16px 18px",
                  borderRadius: "18px",
                  backgroundColor: "#f8fbfc",
                  border: "1px solid rgba(15, 23, 42, 0.06)",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 6px",
                    color: "#102033",
                    fontSize: "17px",
                  }}
                >
                  {card.title}
                </h3>
                <p style={{ margin: 0, color: "#5f6e7d", lineHeight: 1.7 }}>
                  {card.description}
                </p>
              </article>
            ))}
          </div>
        </article>
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
          <h2 style={{ margin: 0, fontSize: "26px" }}>
            Recent library activity
          </h2>
          <a
            href="/search"
            style={{
              color: "#0f766e",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Search knowledge
          </a>
        </div>
        <div style={{ display: "grid", gap: "14px" }}>
          {demoAssets.map((asset) => {
            const statusStyle = statusStyles[asset.status];

            return (
              <article
                key={asset.id}
                style={{
                  padding: "20px 22px",
                  borderRadius: "22px",
                  border: "1px solid rgba(15, 23, 42, 0.08)",
                  backgroundColor: "#ffffff",
                  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.06)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "14px",
                    marginBottom: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong
                      style={{
                        display: "block",
                        fontSize: "18px",
                        color: "#102033",
                      }}
                    >
                      {asset.title}
                    </strong>
                    <span style={{ color: "#5f6e7d", fontSize: "14px" }}>
                      {asset.type} asset
                    </span>
                  </div>
                  <span
                    style={{
                      padding: "8px 12px",
                      borderRadius: "999px",
                      backgroundColor: statusStyle.bg,
                      color: statusStyle.color,
                      fontSize: "13px",
                      fontWeight: 800,
                      textTransform: "capitalize",
                    }}
                  >
                    {asset.status}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    color: "#445160",
                    lineHeight: 1.75,
                  }}
                >
                  {asset.summary}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
};
