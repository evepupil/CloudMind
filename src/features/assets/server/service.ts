import type { AssetSummary } from "@/features/assets/model/types";

// 这里先提供内存态演示数据，后续会替换成 D1 仓储实现。
const demoAssets: AssetSummary[] = [
  {
    id: "asset_demo_architecture",
    type: "url",
    title: "CloudMind 架构草图",
    summary: "单个 HonoX 全栈项目，直接部署到 Cloudflare Pages。",
    status: "ready",
    createdAt: new Date().toISOString(),
  },
  {
    id: "asset_demo_chat_memory",
    type: "chat",
    title: "AI 对话存档",
    summary: "用于演示未来 MCP 写入知识库的最小数据路径。",
    status: "processing",
    createdAt: new Date().toISOString(),
  },
];

// 这里封装资产读取逻辑，避免路由直接依赖数据来源细节。
export const listAssets = (): AssetSummary[] => {
  return demoAssets;
};
