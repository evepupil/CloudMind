import { PageShell } from "@/features/layout/components/page-shell";

type CaptureMode = "url" | "text" | "pdf";

const modes: Array<{
  key: CaptureMode;
  label: string;
  description: string;
}> = [
  {
    key: "url",
    label: "Save URL",
    description:
      "Store a webpage link and send it into the processing pipeline.",
  },
  {
    key: "text",
    label: "Paste Text",
    description: "Capture notes, excerpts, and copied conversations directly.",
  },
  {
    key: "pdf",
    label: "Upload PDF",
    description:
      "Send a document into blob storage and process it asynchronously.",
  },
];

const inputStyles = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid rgba(15, 23, 42, 0.12)",
  fontSize: "15px",
  boxSizing: "border-box" as const,
  backgroundColor: "#ffffff",
};

const renderForm = (mode: CaptureMode) => {
  if (mode === "url") {
    return (
      <form
        action="/assets/actions/ingest-url"
        method="post"
        style={{ display: "grid", gap: "14px" }}
      >
        <label style={{ display: "grid", gap: "8px" }}>
          <span style={{ fontWeight: 700 }}>Title</span>
          <input
            name="title"
            type="text"
            placeholder="Optional title"
            style={inputStyles}
          />
        </label>
        <label style={{ display: "grid", gap: "8px" }}>
          <span style={{ fontWeight: 700 }}>URL</span>
          <input
            name="url"
            type="url"
            placeholder="https://example.com/article"
            style={inputStyles}
          />
        </label>
        <button
          type="submit"
          style={{
            justifySelf: "start",
            padding: "12px 18px",
            borderRadius: "999px",
            border: "none",
            backgroundColor: "#102033",
            color: "#ffffff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Save URL
        </button>
      </form>
    );
  }

  if (mode === "pdf") {
    return (
      <form
        action="/assets/actions/ingest-file"
        method="post"
        encType="multipart/form-data"
        style={{ display: "grid", gap: "14px" }}
      >
        <label style={{ display: "grid", gap: "8px" }}>
          <span style={{ fontWeight: 700 }}>Title</span>
          <input
            name="title"
            type="text"
            placeholder="Optional title"
            style={inputStyles}
          />
        </label>
        <label style={{ display: "grid", gap: "8px" }}>
          <span style={{ fontWeight: 700 }}>PDF File</span>
          <input
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            style={{
              ...inputStyles,
              padding: "10px 12px",
            }}
          />
        </label>
        <button
          type="submit"
          style={{
            justifySelf: "start",
            padding: "12px 18px",
            borderRadius: "999px",
            border: "none",
            backgroundColor: "#0f766e",
            color: "#ffffff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Upload PDF
        </button>
      </form>
    );
  }

  return (
    <form
      action="/assets/actions/ingest-text"
      method="post"
      style={{ display: "grid", gap: "14px" }}
    >
      <label style={{ display: "grid", gap: "8px" }}>
        <span style={{ fontWeight: 700 }}>Title</span>
        <input
          name="title"
          type="text"
          placeholder="Weekly research notes"
          style={inputStyles}
        />
      </label>
      <label style={{ display: "grid", gap: "8px" }}>
        <span style={{ fontWeight: 700 }}>Content</span>
        <textarea
          name="content"
          placeholder="Paste notes, article excerpts, or chat summaries here."
          rows={8}
          style={{
            ...inputStyles,
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
      </label>
      <button
        type="submit"
        style={{
          justifySelf: "start",
          padding: "12px 18px",
          borderRadius: "999px",
          border: "none",
          backgroundColor: "#102033",
          color: "#ffffff",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Save Text
      </button>
    </form>
  );
};

// 这里提供统一 Capture 页原型，用同一个空间承载 URL、文本和 PDF 采集。
export const CapturePage = ({ mode }: { mode: CaptureMode }) => {
  return (
    <PageShell
      title="Capture new knowledge"
      subtitle="Bring webpages, notes, and PDFs into CloudMind through one calm entry point instead of scattered forms."
      navigationKey="capture"
      actions={
        <a
          href="/assets"
          style={{
            padding: "12px 18px",
            borderRadius: "999px",
            backgroundColor: "#dff7f5",
            color: "#0f766e",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Open Library
        </a>
      }
    >
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.3fr) minmax(280px, 0.7fr)",
          gap: "18px",
        }}
      >
        <article
          style={{
            padding: "24px",
            borderRadius: "24px",
            backgroundColor: "#ffffff",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            boxShadow: "0 18px 48px rgba(15, 23, 42, 0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginBottom: "20px",
            }}
          >
            {modes.map((item) => (
              <a
                key={item.key}
                href={`/capture?mode=${item.key}`}
                style={{
                  padding: "10px 14px",
                  borderRadius: "999px",
                  textDecoration: "none",
                  fontWeight: 700,
                  backgroundColor:
                    item.key === mode ? "#102033" : "rgba(15, 23, 42, 0.06)",
                  color: item.key === mode ? "#ffffff" : "#102033",
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
          <h2 style={{ marginTop: 0, fontSize: "28px" }}>
            {modes.find((item) => item.key === mode)?.label}
          </h2>
          <p style={{ color: "#526071", marginTop: 0, marginBottom: "22px" }}>
            {modes.find((item) => item.key === mode)?.description}
          </p>
          {renderForm(mode)}
        </article>

        <aside
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          <article
            style={{
              padding: "20px",
              borderRadius: "24px",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.94) 0%, rgba(225, 244, 241, 0.92) 100%)",
              border: "1px solid rgba(15, 23, 42, 0.08)",
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: "20px" }}>Capture Rules</h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: "18px",
                color: "#526071",
                lineHeight: 1.8,
              }}
            >
              <li>Always keep original assets recoverable.</li>
              <li>AI-derived summaries should remain recomputable.</li>
              <li>Prefer fast ingest over over-designed workflows.</li>
            </ul>
          </article>

          <article
            style={{
              padding: "20px",
              borderRadius: "24px",
              backgroundColor: "#ffffff",
              border: "1px solid rgba(15, 23, 42, 0.08)",
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: "20px" }}>After saving</h3>
            <p style={{ margin: 0, color: "#526071", lineHeight: 1.8 }}>
              Assets enter the processing pipeline, become searchable, and can
              later feed Ask Library with traceable sources.
            </p>
          </article>
        </aside>
      </section>
    </PageShell>
  );
};
