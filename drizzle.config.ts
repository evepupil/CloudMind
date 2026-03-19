import { defineConfig } from "drizzle-kit";

// 这里集中声明 Drizzle 生成配置，后续补 migration 时沿用同一入口。
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/platform/db/d1/schema/index.ts",
  out: "./drizzle",
  strict: true,
});
