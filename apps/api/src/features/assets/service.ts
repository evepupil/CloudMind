import type { AssetSummary } from "@cloudmind/shared";

// 这里先提供一个内存态示例服务，后续会替换为 D1 仓储实现。
const demoAssets: AssetSummary[] = [
  {
    id: "asset_demo_rust_video",
    type: "url",
    title: "Rust 视频精华",
    summary: "介绍了 Rust 所有权、借用和错误处理的核心实践。",
    status: "ready",
    createdAt: new Date().toISOString(),
  },
];

// 这里统一封装资产查询，方便后续切换真实存储实现。
export const listAssets = (): AssetSummary[] => {
  return demoAssets;
};
