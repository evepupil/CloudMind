import { describe, expect, it } from "vitest";

import {
  applySalienceWeight,
  computeSalience,
} from "@/features/memory/server/salience";

// 固定「现在」让 recency 衰减可断言。
const NOW_MS = Date.parse("2026-01-11T00:00:00.000Z");

describe("applySalienceWeight", () => {
  it("is neutral when createdAt is null and importance/access are zero", () => {
    expect(
      applySalienceWeight(
        2,
        { createdAt: null, importance: 0, accessCount: 0 },
        { nowMs: NOW_MS }
      )
    ).toBe(2);
  });

  it("halves the score at exactly one half-life of age", () => {
    // createdAt 比 now 早 10 天，halfLife=10 → recency = 0.5^1 = 0.5。
    const result = applySalienceWeight(
      1,
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        importance: 0,
        accessCount: 0,
      },
      { nowMs: NOW_MS, halfLifeDays: 10 }
    );

    expect(result).toBeCloseTo(0.5, 10);
  });

  it("does not decay a future createdAt below the base (age clamped to 0)", () => {
    const result = applySalienceWeight(
      1,
      {
        createdAt: "2026-02-01T00:00:00.000Z",
        importance: 0,
        accessCount: 0,
      },
      { nowMs: NOW_MS, halfLifeDays: 10 }
    );

    expect(result).toBe(1);
  });

  it("treats an unparseable createdAt as no decay", () => {
    expect(
      applySalienceWeight(
        1,
        { createdAt: "not-a-date", importance: 0, accessCount: 0 },
        { nowMs: NOW_MS }
      )
    ).toBe(1);
  });

  it("boosts by (1 + importance)", () => {
    const result = applySalienceWeight(
      1,
      { createdAt: null, importance: 1, accessCount: 0 },
      { nowMs: NOW_MS }
    );

    expect(result).toBe(2);
  });

  it("increases monotonically with access count", () => {
    const inputs = (accessCount: number) => ({
      createdAt: null,
      importance: 0,
      accessCount,
    });
    const low = applySalienceWeight(1, inputs(1), { nowMs: NOW_MS });
    const high = applySalienceWeight(1, inputs(50), { nowMs: NOW_MS });

    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThan(1);
  });

  it("clamps negative importance/access to neutral", () => {
    expect(
      applySalienceWeight(
        3,
        { createdAt: null, importance: -5, accessCount: -10 },
        { nowMs: NOW_MS }
      )
    ).toBe(3);
  });
});

describe("computeSalience", () => {
  it("is 0 when there is no signal", () => {
    expect(computeSalience({ mentionCount: 0, accessCount: 0 })).toBe(0);
  });

  it("stays within [0, 1) and saturates upward", () => {
    const small = computeSalience({ mentionCount: 1, accessCount: 1 });
    const large = computeSalience({ mentionCount: 100, accessCount: 100 });

    expect(small).toBeGreaterThan(0);
    expect(large).toBeGreaterThan(small);
    expect(large).toBeLessThan(1);
  });

  it("weights access more heavily than mention", () => {
    const byMention = computeSalience({ mentionCount: 10, accessCount: 0 });
    const byAccess = computeSalience({ mentionCount: 0, accessCount: 10 });

    expect(byAccess).toBeGreaterThan(byMention);
  });
});
