import type { Child } from "hono/jsx";

// 这里统一页面页头，让标题区更像产品工作台而不是纯展示页。
export const PageHeader = ({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: Child | undefined;
}) => {
  return (
    <header
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: "20px",
        alignItems: "end",
        marginBottom: "24px",
        padding: "20px 24px 22px",
        borderRadius: "28px",
        border: "1px solid rgba(21, 33, 51, 0.08)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(255,250,245,0.92) 100%)",
        boxShadow: "0 18px 46px rgba(28, 39, 56, 0.06)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            margin: "0 0 10px",
            color: "#f48120",
            fontSize: "11px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 800,
          }}
        >
          CloudMind workspace
        </p>
        <h1
          style={{
            margin: 0,
            color: "#16202d",
            fontSize: "clamp(30px, 4vw, 46px)",
            lineHeight: 1.02,
            fontWeight: 800,
            letterSpacing: "-0.03em",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            maxWidth: "760px",
            margin: "12px 0 0",
            color: "#566375",
            fontSize: "16px",
            lineHeight: 1.7,
          }}
        >
          {subtitle}
        </p>
      </div>
      {actions ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          {actions}
        </div>
      ) : null}
    </header>
  );
};
