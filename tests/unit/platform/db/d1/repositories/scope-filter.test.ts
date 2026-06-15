import { and } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import {
  buildAssetListWhereClause,
  buildAssetSearchFilterConditions,
} from "@/platform/db/d1/repositories/d1-asset-repository-helpers";

const dialect = new SQLiteSyncDialect();

// 一期 scope 隔离：L1 检索默认只查 personal（人记忆），agent 记忆走独立 scope、不进默认检索。
// 这里把 where 条件编译成 SQL 直接断言确实带 scope_id = 'personal'，
// 防止后续有人无意把过滤改回全量、导致 agent 记忆泄漏进默认检索。
describe("scope 隔离 · L1 检索条件", () => {
  it("资产列表 where 默认带 scope_id = 'personal'", () => {
    const where = buildAssetListWhereClause();
    if (!where) {
      throw new Error("buildAssetListWhereClause 不应返回 undefined");
    }

    const { sql, params } = dialect.sqlToQuery(where);
    expect(sql).toContain("scope_id");
    expect(params).toContain("personal");
  });

  it("lexical 检索条件默认带 scope_id = 'personal'", () => {
    const conditions = buildAssetSearchFilterConditions();
    const combined = and(...conditions);
    if (!combined) {
      throw new Error("buildAssetSearchFilterConditions 不应为空");
    }

    const { sql, params } = dialect.sqlToQuery(combined);
    expect(sql).toContain("scope_id");
    expect(params).toContain("personal");
  });
});
