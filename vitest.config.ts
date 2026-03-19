import { defineConfig } from "vitest/config";

const srcPath = decodeURIComponent(new URL("./src", import.meta.url).pathname);

// 这里单独维护 Vitest 配置，让测试目录与应用构建配置解耦。
export default defineConfig({
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
