// 这里定义知识资产相关的领域类型，供页面和 API 统一复用。
export type AssetType = "url" | "pdf" | "note" | "image" | "chat";

// 这里约束资产处理状态，避免各处散落字符串字面量。
export type AssetStatus = "pending" | "processing" | "ready" | "failed";

// 这里定义第一版资产摘要结构，后续接数据库时继续扩展。
export interface AssetSummary {
  id: string;
  type: AssetType;
  title: string;
  summary: string;
  status: AssetStatus;
  createdAt: string;
}
