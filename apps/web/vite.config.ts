import build from "@hono/vite-build/cloudflare-workers";
import honox from "honox/vite";
import { defineConfig } from "vite";

const srcPath = decodeURIComponent(new URL("./src", import.meta.url).pathname);

// 这里为 HonoX 提供最小 Vite 配置，并声明项目内路径别名。
export default defineConfig({
  plugins: [honox(), build()],
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
});
