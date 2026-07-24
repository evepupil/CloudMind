import { describe, expect, it } from "vitest";

import {
  normalizeRecordFilters,
  RecordFilterConflictError,
  withRecordFilterDefaults,
} from "@/core/records/filters";

describe("record filters", () => {
  it("去重数组，并把空数组按省略处理", () => {
    expect(
      normalizeRecordFilters({
        recordKinds: ["memory", "memory"],
        scopeIds: [],
        contextKeys: ["global", "global"],
      })
    ).toEqual({
      recordKinds: ["memory"],
      contextKeys: ["global"],
    });
  });

  it("把旧单值参数规范化为数组", () => {
    expect(
      normalizeRecordFilters({
        recordKind: "library",
        scopeId: "personal",
        contextKey: "project:github:evepupil/CloudMind",
      })
    ).toEqual({
      recordKinds: ["library"],
      scopeIds: ["personal"],
      contextKeys: ["project:github:evepupil/CloudMind"],
    });
  });

  it("新旧参数同时出现时明确报错", () => {
    expect(() =>
      normalizeRecordFilters({
        scopeId: "personal",
        scopeIds: ["agent"],
      })
    ).toThrow(RecordFilterConflictError);
  });

  it("只为调用方未提供的维度应用工具默认值", () => {
    expect(
      withRecordFilterDefaults(
        { scopeIds: ["agent"] },
        {
          recordKinds: ["memory"],
          scopeIds: ["personal"],
          contextKeys: ["global"],
        }
      )
    ).toEqual({
      recordKinds: ["memory"],
      scopeIds: ["agent"],
      contextKeys: ["global"],
    });
  });
});
