import { jsxRenderer } from "hono/jsx-renderer";
import { Script } from "honox/server/components/script";

// 全站 HTML 外壳：Observatory 深墨底 + 氛围层（点阵网格 + 地平线暖光 + 胶片颗粒）。
// CSS 路径分环境：
// - Dev: Vite + @tailwindcss/vite 实时处理 /src/styles/app.css（HMR）
// - Prod: Cloudflare Workers 从 public/ 提供 build:css 预编译的 /styles.css
// Script 内部已用 HasIslands 条件包装：仅当页面真正用到 island 才注入客户端 JS
// （渐进增强：无 island 即零客户端 JS）。children 直接渲染，不要用 HasIslands 包裹
// ——否则无 island 的页面 children 会被吞成空 body。
const cssHref = import.meta.env.DEV ? "/src/styles/app.css" : "/styles.css";

export default jsxRenderer(({ children }) => {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* theme-color 与深墨底 #0a0c10 对齐，移动端浏览器 chrome 融入深色 */}
        <meta name="theme-color" content="#0a0c10" />
        {/* 首屏关键字体预加载：标题 Fraunces 正体 + 正文 Hanken（latin） */}
        <link
          rel="preload"
          href="/fonts/fraunces-latin-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossorigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/hanken-grotesk-latin-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossorigin="anonymous"
        />
        <link rel="stylesheet" href={cssHref} />
        <title>CloudMind</title>
      </head>
      <body>
        {/* 全站氛围底层（纯装饰，aria-hidden）：点阵网格 + 地平线暖光 + 颗粒 */}
        <div class="atmos" aria-hidden="true" />
        <div class="atmos-grain" aria-hidden="true" />
        {children}
        <Script src="/app/client.ts" />
      </body>
    </html>
  );
});
