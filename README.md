# CloudMind

CloudMind 是一个开源、个人可控、serverless-first 的 AI 个人知识库。

## 工作区结构

- `apps/api`：基于 Hono 的后端 API 与 MCP 入口
- `apps/web`：基于 HonoX 的前端界面
- `packages/shared`：前后端共享类型与常量

## 快速开始

```bash
npm install
npm run dev:web
npm run dev:api
```

## 开发规范

请先阅读根目录下的 `AGENTS.md`。
