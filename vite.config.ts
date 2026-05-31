import build from "@hono/vite-build/cloudflare-workers";
import tailwindcss from "@tailwindcss/vite";
import honox from "honox/vite";
import { defineConfig } from "vite";

const srcPath = decodeURIComponent(new URL("./src", import.meta.url).pathname);

// 这里把 HonoX 全栈项目切到 Cloudflare Workers 构建目标。
// ajv / ajv-formats 是 @modelcontextprotocol/sdk 的 CJS 依赖，
// 必须标记为 external 否则 esbuild 无法打包 CJS 模块。
export default defineConfig({
  plugins: [
    tailwindcss(),
    honox(),
    build({
      emptyOutDir: true,
      external: ["ajv", "ajv-formats"],
    }),
  ],
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
});
