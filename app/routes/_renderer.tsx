import { jsxRenderer } from "hono/jsx-renderer";
import { Script } from "honox/server/components/script";

// 全站 HTML 外壳：Glass/Aurora 深色底。CSS 路径分环境：
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
        {/* theme-color 与极光底 #0b0f1a 对齐，让移动端浏览器 chrome 融入深色底 */}
        <meta name="theme-color" content="#0b0f1a" />
        <link rel="stylesheet" href={cssHref} />
        <title>CloudMind</title>
      </head>
      <body>
        {children}
        <Script src="/app/client.ts" />
      </body>
    </html>
  );
});
