import { and } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import {
  buildAssetListWhereClause,
  buildAssetSearchFilterConditions,
} from "@/platform/db/d1/repositories/d1-asset-repository-helpers";

const dialect = new SQLiteSyncDialect();

describe("三维归属 · L1 检索条件", () => {
  it("列表和检索默认排除已被取代的 memory 版本", () => {
    const listWhere = buildAssetListWhereClause();
    const searchWhere = and(...buildAssetSearchFilterConditions());

    if (!listWhere || !searchWhere) {
      throw new Error("资产过滤条件不应为空");
    }

    expect(dialect.sqlToQuery(listWhere).sql).toContain("superseded_at");
    expect(dialect.sqlToQuery(searchWhere).sql).toContain("superseded_at");
  });

  it("省略归属维度时不添加 scope 条件", () => {
    const where = buildAssetListWhereClause();
    if (!where) {
      throw new Error("buildAssetListWhereClause 不应返回 undefined");
    }

    const { sql, params } = dialect.sqlToQuery(where);
    expect(sql).not.toContain("scope_id");
    expect(params).not.toContain("personal");
  });

  it("lexical 省略归属维度时不添加 scope 条件", () => {
    const conditions = buildAssetSearchFilterConditions();
    const combined = and(...conditions);
    if (!combined) {
      throw new Error("buildAssetSearchFilterConditions 不应为空");
    }

    const { sql, params } = dialect.sqlToQuery(combined);
    expect(sql).not.toContain("scope_id");
    expect(params).not.toContain("personal");
  });

  it("资产列表 where 传 scopeId=agent 时按 agent 过滤", () => {
    const where = buildAssetListWhereClause({ scopeId: "agent" });
    if (!where) {
      throw new Error("buildAssetListWhereClause 不应返回 undefined");
    }

    const { params } = dialect.sqlToQuery(where);
    expect(params).toContain("agent");
    expect(params).not.toContain("personal");
  });

  it("lexical 检索条件传 scopeId=agent 时按 agent 过滤", () => {
    const conditions = buildAssetSearchFilterConditions({ scopeId: "agent" });
    const combined = and(...conditions);
    if (!combined) {
      throw new Error("buildAssetSearchFilterConditions 不应为空");
    }

    const { params } = dialect.sqlToQuery(combined);
    expect(params).toContain("agent");
    expect(params).not.toContain("personal");
  });

  it("三维过滤同时编译为 record、scope 和 context 条件", () => {
    const conditions = buildAssetSearchFilterConditions({
      recordKind: "memory",
      scopeId: "agent",
      contextKey: "project:github:evepupil/CloudMind",
    });
    const combined = and(...conditions);

    if (!combined) {
      throw new Error("buildAssetSearchFilterConditions 不应为空");
    }

    const { sql, params } = dialect.sqlToQuery(combined);
    expect(sql).toContain("record_kind");
    expect(sql).toContain("scope_id");
    expect(sql).toContain("context_key");
    expect(params).toEqual(
      expect.arrayContaining([
        "memory",
        "agent",
        "project:github:evepupil/CloudMind",
      ])
    );
  });

  it("同维度多值使用 OR，三个维度之间使用 AND", () => {
    const conditions = buildAssetSearchFilterConditions({
      recordKinds: ["library", "memory"],
      scopeIds: ["personal", "agent"],
      contextKeys: [
        "project:github:evepupil/CloudMind",
        "project:github:evepupil/AnotherProject",
      ],
    });
    const combined = and(...conditions);

    if (!combined) {
      throw new Error("buildAssetSearchFilterConditions 不应为空");
    }

    const { sql, params } = dialect.sqlToQuery(combined);
    expect(sql.match(/ in \(\?, \?\)/g)).toHaveLength(3);
    expect(params).toEqual(
      expect.arrayContaining([
        "library",
        "memory",
        "personal",
        "agent",
        "project:github:evepupil/CloudMind",
        "project:github:evepupil/AnotherProject",
      ])
    );
  });
});
