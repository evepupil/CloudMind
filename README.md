# CloudMind

CloudMind 是一个开源、个人可控、serverless-first 的 AI 个人知识库。

当前项目采用 **单个 HonoX 全栈应用** 结构：

- 页面与 API 在同一个项目中维护
- 直接构建到 `dist/`
- 可直接部署到 Cloudflare Pages

## 技术栈

- 全栈框架：`HonoX`
- 路由与 API：`Hono`
- 语言：`TypeScript`
- 格式化与 lint：`Biome`
- 部署目标：`Cloudflare Pages`

## 开发命令

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
```

## Pages 部署

```bash
npm run build
npm run pages:dev
npm run pages:deploy
```

更多约束请查看 `AGENTS.md`。
