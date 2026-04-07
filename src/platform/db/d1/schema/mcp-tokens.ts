import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// 这里定义 MCP bearer token 表，当前保留 token 原文以支持后台再次查看。
export const mcpTokens = sqliteTable(
  "mcp_tokens",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    tokenValue: text("token_value").notNull(),
    tokenHash: text("token_hash").notNull(),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("mcp_tokens_token_hash_uidx").on(table.tokenHash),
    index("mcp_tokens_created_at_idx").on(table.createdAt),
    index("mcp_tokens_revoked_at_idx").on(table.revokedAt),
  ]
);
