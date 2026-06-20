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
  // dev SSR：ajv / ajv-formats 是 @modelcontextprotocol/sdk 的 CommonJS 依赖，
  // Vite 的 SSR module runner 若当 ESM 求值会因 `exports is not defined` 崩渲染
  // （island 机制把 MCP 模块图拽进 SSR 求值后触发）。留 external 交给 Node 原生
  // require 处理（CJS 环境里 exports 存在），与上方 workers 构建的 external 对齐。
  ssr: {
    external: ["ajv", "ajv-formats"],
  },
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
});
