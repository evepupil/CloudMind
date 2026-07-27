# CloudMind Landing Page

`web/` 是 CloudMind 的独立静态产品入口。它不接入 Worker 运行时，也不包含账号、
记忆或部署凭据；可直接部署到 Cloudflare Pages 或任意静态文件服务。

## 本地查看

在 `web/` 目录使用任意静态文件服务打开 `index.html`。页面没有构建步骤和第三方运行时
依赖。

## 内容边界

- 产品能力和架构描述必须与根目录 `README` 和 `docs/` 保持一致。
- 部署入口指向仓库中经过维护的部署说明，避免在落地页复制易漂移的命令。
- `public/observatory-overview.png` 来自仓库内的 Observatory 设计稿，用于展示真实工作台。
