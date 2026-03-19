import type { Child } from "hono/jsx";

// 这里封装页面通用布局，避免首页直接堆大量结构。
export const PageShell = ({
  children,
  title,
  subtitle,
}: {
  children: Child;
  title: string;
  subtitle: string;
}) => {
  return (
    <main
      style={{
        maxWidth: "960px",
        margin: "0 auto",
        padding: "48px 24px 80px",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <header style={{ marginBottom: "32px" }}>
        <p
          style={{
            margin: 0,
            color: "#4f46e5",
            fontSize: "14px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          CloudMind
        </p>
        <h1 style={{ margin: "12px 0", fontSize: "40px", lineHeight: 1.1 }}>
          {title}
        </h1>
        <p style={{ margin: 0, color: "#475569", fontSize: "18px" }}>
          {subtitle}
        </p>
      </header>
      {children}
    </main>
  );
};
