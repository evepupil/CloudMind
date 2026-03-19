import type { Child } from "hono/jsx";

// 这里统一页头结构，让页面标题、描述和操作区保持一致。
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
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "20px",
        marginBottom: "28px",
        paddingBottom: "20px",
        borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            margin: "0 0 8px",
            color: "#0f766e",
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          CloudMind Workspace
        </p>
        <h1
          style={{
            margin: 0,
            color: "#102033",
            fontSize: "clamp(34px, 4vw, 54px)",
            lineHeight: 1.02,
            fontFamily: '"Georgia", "Palatino Linotype", serif',
          }}
        >
          {title}
        </h1>
        <p
          style={{
            maxWidth: "720px",
            margin: "12px 0 0",
            color: "#526071",
            fontSize: "17px",
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
