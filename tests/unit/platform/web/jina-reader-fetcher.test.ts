import { describe, expect, it } from "vitest";

import {
  JinaReaderWebPageFetcher,
  parseJinaReaderResponse,
} from "@/platform/web/jina/jina-reader-fetcher";

const SAMPLE_RAW =
  "Title: CloudMind Memory Layer\n" +
  "URL Source: https://example.com/cloudmind\n" +
  "Markdown Content:\n" +
  "# CloudMind\n\nA sovereign personal memory layer.";

describe("parseJinaReaderResponse", () => {
  it("re-derives content, title, and source url from an archived response", () => {
    const result = parseJinaReaderResponse(
      SAMPLE_RAW,
      "https://fallback.example.com",
      "2026-06-07T00:00:00.000Z"
    );

    expect(result.title).toBe("CloudMind Memory Layer");
    expect(result.sourceUrl).toBe("https://example.com/cloudmind");
    expect(result.content).toBe(
      "# CloudMind\n\nA sovereign personal memory layer."
    );
    expect(result.rawContent).toBe(SAMPLE_RAW.trim());
    expect(result.fetchedAt).toBe("2026-06-07T00:00:00.000Z");
    expect(result.provider).toBe("jina_reader");
  });

  it("falls back to the provided source url when the archive omits one", () => {
    const result = parseJinaReaderResponse(
      "Markdown Content:\nBody without a URL Source header.",
      "https://fallback.example.com/post",
      ""
    );

    expect(result.sourceUrl).toBe("https://fallback.example.com/post");
  });

  it("derives the title from the first heading when no Title header exists", () => {
    const result = parseJinaReaderResponse(
      "Markdown Content:\n# Heading Title\n\nBody text.",
      "https://example.com",
      ""
    );

    expect(result.title).toBe("Heading Title");
  });

  it("treats the whole payload as content when no Markdown Content marker exists", () => {
    const result = parseJinaReaderResponse(
      "Just some plain markdown body.",
      "https://example.com",
      ""
    );

    expect(result.content).toBe("Just some plain markdown body.");
  });

  it("throws when the archived response is empty", () => {
    expect(() =>
      parseJinaReaderResponse("   ", "https://example.com", "")
    ).toThrow("Jina Reader returned empty content.");
  });
});

describe("JinaReaderWebPageFetcher.parseArchived", () => {
  it("parses archived raw with an empty fetchedAt (not a fresh fetch)", () => {
    const fetcher = new JinaReaderWebPageFetcher();
    const result = fetcher.parseArchived(SAMPLE_RAW, "https://example.com");

    expect(result.sourceUrl).toBe("https://example.com/cloudmind");
    expect(result.content).toBe(
      "# CloudMind\n\nA sovereign personal memory layer."
    );
    // 存档重算不代表本次联网抓取，fetchedAt 留空。
    expect(result.fetchedAt).toBe("");
  });
});
