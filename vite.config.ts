import build from "@hono/vite-build/cloudflare-workers";
import tailwindcss from "@tailwindcss/vite";
import honox from "honox/vite";
import { defineConfig } from "vite";

const srcPath = decodeURIComponent(new URL("./src", import.meta.url).pathname);

// 这里把 HonoX 全栈项目切到 Cloudflare Workers 构建目标。
export default defineConfig({
  plugins: [tailwindcss(), honox(), build({ emptyOutDir: true })],
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
  ssr: {
    // ajv 是 CJS 模块，@modelcontextprotocol/sdk 依赖它。
    // Vite SSR 模块加载器会把 CJS 转成 ESM，导致 "exports is not defined"。
    // 将这些包标记为 external，让 Node.js 原生 CJS 加载器处理。
    external: ["ajv", "ajv-formats"],
  },
});
