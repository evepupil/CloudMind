import build from "@hono/vite-build/cloudflare-workers";
import honox from "honox/vite";
import { defineConfig } from "vite";

const srcPath = decodeURIComponent(new URL("./src", import.meta.url).pathname);

// 这里把 HonoX 全栈项目切到 Cloudflare Workers 构建目标。
export default defineConfig({
  plugins: [honox(), build({ emptyOutDir: true })],
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
});
