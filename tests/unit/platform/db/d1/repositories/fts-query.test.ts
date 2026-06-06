import { describe, expect, it } from "vitest";

import { buildFtsMatchQuery } from "@/platform/db/d1/repositories/fts-query";

describe("buildFtsMatchQuery", () => {
  it("builds an OR of quoted phrases from whitespace-separated terms", () => {
    expect(buildFtsMatchQuery("serverless sqlite database")).toBe(
      '"serverless" OR "sqlite" OR "database"'
    );
  });

  it("keeps CJK terms of >=3 chars (trigram-matchable)", () => {
    expect(buildFtsMatchQuery("向量检索 余弦相似度")).toBe(
      '"向量检索" OR "余弦相似度"'
    );
  });

  it("drops terms shorter than 3 chars (trigram minimum)", () => {
    // "咖啡" is 2 chars (cannot match under trigram); the 3-char term survives.
    expect(buildFtsMatchQuery("咖啡 手冲咖")).toBe('"手冲咖"');
  });

  it("returns null when nothing is matchable", () => {
    expect(buildFtsMatchQuery("咖啡")).toBeNull();
    expect(buildFtsMatchQuery("  ")).toBeNull();
  });

  it("escapes embedded double quotes", () => {
    expect(buildFtsMatchQuery('say "hello"')).toBe('"say" OR """hello"""');
  });
});
