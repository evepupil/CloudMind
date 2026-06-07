import { describe, expect, it } from "vitest";

import { normalizeDateOnlyFilter } from "@/features/assets/server/schemas";

// 时间过滤的归一化：所有时间值必须落到 UTC Z 格式，才能与存储的 asset.createdAt（恒 Z）
// 做字典序=时间序的比较（Vectorize 原生过滤 + D1 范围查询都依赖这一点）。
describe("normalizeDateOnlyFilter", () => {
  it("normalizes an ISO datetime with offset to UTC Z format", () => {
    // +08:00 的 00:00 = 前一天 16:00 UTC；不归一化则与 Z 格式字典序比较会错。
    expect(
      normalizeDateOnlyFilter("2026-06-08T00:00:00+08:00", "start", undefined)
    ).toBe("2026-06-07T16:00:00.000Z");
  });

  it("passes a UTC Z datetime through unchanged", () => {
    expect(
      normalizeDateOnlyFilter("2026-06-08T10:30:45.123Z", "end", undefined)
    ).toBe("2026-06-08T10:30:45.123Z");
  });

  it("converts a date-only value with browser timezone offset to a UTC Z boundary", () => {
    // UTC+8 的浏览器 offset 为 -480；2026-06-08 起始 → 前一天 16:00Z。
    expect(normalizeDateOnlyFilter("2026-06-08", "start", -480)).toBe(
      "2026-06-07T16:00:00.000Z"
    );
  });

  it("returns undefined for an empty value", () => {
    expect(normalizeDateOnlyFilter(undefined, "start", undefined)).toBe(
      undefined
    );
  });
});
