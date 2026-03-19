// 这里定义知识资产相关的共享类型，供前后端统一复用。
export type AssetType = "url" | "pdf" | "note" | "image" | "chat";

// 这里约束资产处理状态，避免前后端字符串漂移。
export type AssetStatus = "pending" | "processing" | "ready" | "failed";

// 这里定义首页和接口都能消费的最小资产摘要结构。
export interface AssetSummary {
  id: string;
  type: AssetType;
  title: string;
  summary: string;
  status: AssetStatus;
  createdAt: string;
}
