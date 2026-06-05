import { describe, expect, it } from "vitest";

import { chunkAssetContent } from "@/features/ingest/server/chunking";
import { cleanContentPreservingStructure } from "@/features/ingest/server/content-processing";

describe("cleanContentPreservingStructure", () => {
  it("collapses intra-line whitespace but preserves newlines and paragraph breaks", () => {
    const cleaned = cleanContentPreservingStructure(
      "# Title\r\n\r\nfirst   line\t with spaces.\n\n\n\nsecond paragraph.   "
    );

    expect(cleaned).toBe(
      "# Title\n\nfirst line with spaces.\n\nsecond paragraph."
    );
  });

  it("keeps heading and list markers at line start", () => {
    const cleaned = cleanContentPreservingStructure(
      "# Heading\n- item one\n- item two"
    );

    expect(cleaned).toContain("# Heading");
    expect(cleaned).toContain("- item one");
  });
});

describe("chunkAssetContent", () => {
  it("returns no chunks for empty or whitespace-only input", () => {
    expect(chunkAssetContent("")).toEqual([]);
    expect(chunkAssetContent("   \n\t  \n")).toEqual([]);
  });

  it("aligns chunk boundaries to headings and keeps sentences intact", () => {
    const doc = [
      "# Introduction",
      "",
      "CloudMind is a memory layer. It stores facts and entities.",
      "",
      "# Retrieval",
      "",
      "Retrieval uses hybrid search. Fusion combines ranked lists. Reranking reorders results.",
    ].join("\n");

    const chunks = chunkAssetContent(doc, {
      chunkTokens: 20,
      overlapTokens: 0,
    });

    expect(chunks.length).toBeGreaterThan(1);
    // 标题作为结构边界落在某个 chunk 的开头（旧的字符切块会把它切碎）。
    expect(chunks.some((chunk) => chunk.text.startsWith("# Retrieval"))).toBe(
      true
    );
    expect(
      chunks.some((chunk) => chunk.text.startsWith("# Introduction"))
    ).toBe(true);
    // 句子不被切碎：完整句子落在单个 chunk 内。
    expect(
      chunks.some((chunk) =>
        chunk.text.includes("Fusion combines ranked lists.")
      )
    ).toBe(true);
    // chunkIndex 连续且 preview 非空。
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual(
      chunks.map((_, index) => index)
    );
    expect(chunks.every((chunk) => chunk.textPreview.length > 0)).toBe(true);
  });

  it("hard-splits an oversized sentence without structure", () => {
    const longSentence = `${"word ".repeat(400)}end`;
    const chunks = chunkAssetContent(longSentence, { chunkTokens: 40 });

    expect(chunks.length).toBeGreaterThan(1);
  });

  it("carries sentence-safe overlap between consecutive chunks", () => {
    const doc =
      "Alpha one sentence. Beta two sentence. Gamma three sentence. Delta four sentence.";
    const chunks = chunkAssetContent(doc, {
      chunkTokens: 12,
      overlapTokens: 6,
    });

    expect(chunks.length).toBeGreaterThan(1);

    const first = chunks[0];
    const second = chunks[1];

    expect(first).toBeDefined();
    expect(second).toBeDefined();

    if (first && second) {
      const firstSentences = first.text.split(/(?<=\.)\s+/);
      const lastOfFirst = firstSentences[firstSentences.length - 1] ?? "";

      expect(lastOfFirst.length).toBeGreaterThan(0);
      expect(second.text.includes(lastOfFirst)).toBe(true);
    }
  });

  it("applies per-asset-type token budgets", () => {
    const paragraphs = Array.from(
      { length: 12 },
      (_, index) =>
        `Paragraph ${index} sentence one. Paragraph ${index} sentence two.`
    ).join("\n\n");

    const chatChunks = chunkAssetContent(paragraphs, { assetType: "chat" });
    const pdfChunks = chunkAssetContent(paragraphs, { assetType: "pdf" });

    // 更小的 chat 预算应产生不少于 pdf 预算的 chunk 数。
    expect(chatChunks.length).toBeGreaterThanOrEqual(pdfChunks.length);
  });
});
