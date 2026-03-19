import { jsxRenderer } from "hono/jsx-renderer";

// 这里定义全站基础 HTML 外壳，保证 SSR 页面结构统一。
export default jsxRenderer(({ children }) => {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>CloudMind</title>
      </head>
      <body>{children}</body>
    </html>
  );
});
