import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// 这里定义单用户认证表，先支撑 admin 登录和首次改密。
export const authAccounts = sqliteTable(
  "auth_accounts",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    passwordIterations: integer("password_iterations").notNull(),
    mustChangePassword: integer("must_change_password", {
      mode: "boolean",
    })
      .notNull()
      .default(true),
    lastLoginAt: text("last_login_at"),
    passwordUpdatedAt: text("password_updated_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("auth_accounts_username_uidx").on(table.username),
    index("auth_accounts_created_at_idx").on(table.createdAt),
  ]
);
