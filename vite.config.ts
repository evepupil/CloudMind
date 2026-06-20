import build from "@hono/vite-build/cloudflare-workers";
import tailwindcss from "@tailwindcss/vite";
import honox from "honox/vite";
import { defineConfig } from "vite";

const srcPath = decodeURIComponent(new URL("./src", import.meta.url).pathname);

// 这里把 HonoX 全栈项目切到 Cloudflare Workers 构建目标。
// ajv / ajv-formats 是 @modelcontextprotocol/sdk 的 CJS 依赖，必须标记为 external
// 否则 esbuild 无法打包 CJS 模块。dev SSR 同样 external（见下方 ssr.external）。
//
// 注意：本项目的真正本地 dev 是 `npm run worker:dev`（= wrangler dev，带 D1/R2/AI
// bindings），不是裸 `npm run dev`（vite，无 bindings，任何需 auth/DB 的页都会 500）。
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
  // Vite SSR module runner 若当 ESM 求值会因 `exports is not defined` 崩渲染。
  // 注：honox() 的 config 钩子设了 ssr.noExternal:true，会压制 ssr.external；
  // 此处 ssr.external 仅对「绕过 honox noExternal 的路径」生效，wrangler dev 走
  // build 产物不受影响。完整本地 dev 请用 `npm run worker:dev`。
  ssr: {
    external: ["ajv", "ajv-formats"],
  },
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
});
