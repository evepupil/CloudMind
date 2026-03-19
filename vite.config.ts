import build from "@hono/vite-build/cloudflare-pages";
import honox from "honox/vite";
import { defineConfig } from "vite";

const srcPath = decodeURIComponent(new URL("./src", import.meta.url).pathname);

// 这里配置单个 HonoX 全栈项目，并直接输出为 Pages 可部署产物。
export default defineConfig({
  plugins: [honox(), build()],
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
});
