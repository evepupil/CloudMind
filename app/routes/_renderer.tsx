import { jsxRenderer } from "hono/jsx-renderer";

// 这里定义全站基础 HTML 外壳，保证 SSR 页面结构统一。
// CSS 路径分环境处理：
// - Dev: Vite + @tailwindcss/vite 实时处理 /src/styles/app.css（支持 HMR）
// - Prod: Cloudflare Workers 从 public/ 提供静态文件 /styles.css
const cssHref = import.meta.env.DEV ? "/src/styles/app.css" : "/styles.css";

export default jsxRenderer(({ children }) => {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href={cssHref} />
        <title>CloudMind</title>
      </head>
      <body>{children}</body>
    </html>
  );
});
