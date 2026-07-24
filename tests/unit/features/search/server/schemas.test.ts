import { describe, expect, it } from "vitest";

import { assetSearchPayloadSchema } from "@/features/search/server/schemas";

describe("asset search record filters", () => {
  it("接受三维数组过滤并保留数组形状", () => {
    const parsed = assetSearchPayloadSchema.parse({
      query: "M1 progress",
      recordKinds: ["memory"],
      scopeIds: ["personal", "agent"],
      contextKeys: ["project:github:evepupil/CloudMind"],
    });

    expect(parsed).toMatchObject({
      recordKinds: ["memory"],
      scopeIds: ["personal", "agent"],
      contextKeys: ["project:github:evepupil/CloudMind"],
    });
  });

  it("继续接受旧单值参数", () => {
    expect(
      assetSearchPayloadSchema.parse({
        query: "M2 decision",
        recordKind: "memory",
        scopeId: "agent",
        contextKey: "global",
      })
    ).toMatchObject({
      recordKind: "memory",
      scopeId: "agent",
      contextKey: "global",
    });
  });

  it("新旧同维参数一起出现时拒绝输入", () => {
    const parsed = assetSearchPayloadSchema.safeParse({
      query: "M3 plan",
      scopeId: "personal",
      scopeIds: ["agent"],
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(["scopeIds"]);
    }
  });
});
