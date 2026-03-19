// 这里定义知识资产相关的领域类型，供页面和 API 统一复用。
export type AssetType = "url" | "pdf" | "note" | "image" | "chat";

// 这里约束资产处理状态，避免各处散落字符串字面量。
export type AssetStatus = "pending" | "processing" | "ready" | "failed";

// 这里定义资产来源类型，便于后续扩展浏览器插件、MCP 与文件上传入口。
export type AssetSourceKind =
  | "manual"
  | "browser_extension"
  | "upload"
  | "mcp"
  | "import";

// 这里统一异步任务状态，便于详情页和重试能力复用。
export type IngestJobStatus = "queued" | "running" | "succeeded" | "failed";

// 这里先覆盖 MVP 处理链步骤，后续接 Queues 时直接复用。
export type IngestJobType =
  | "fetch_source"
  | "extract_content"
  | "clean_content"
  | "summarize"
  | "classify"
  | "chunk"
  | "embed"
  | "index"
  | "finalize";

export interface AssetListQuery {
  status?: AssetStatus | undefined;
  type?: AssetType | undefined;
  query?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AssetListResult {
  items: AssetSummary[];
  pagination: PaginationInfo;
}

// 这里定义列表页用的资产摘要结构。
export interface AssetSummary {
  id: string;
  type: AssetType;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
  status: AssetStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AssetSourceInfo {
  kind: AssetSourceKind;
  sourceUrl: string | null;
  metadataJson: string | null;
  createdAt: string;
}

export interface IngestJobSummary {
  id: string;
  jobType: IngestJobType;
  status: IngestJobStatus;
  attempt: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetChunkSummary {
  id: string;
  chunkIndex: number;
  textPreview: string;
  vectorId: string | null;
}

// 这里定义详情页与详情 API 需要的完整资产结构。
export interface AssetDetail extends AssetSummary {
  contentText: string | null;
  rawR2Key: string | null;
  contentR2Key: string | null;
  mimeType: string | null;
  language: string | null;
  errorMessage: string | null;
  processedAt: string | null;
  failedAt: string | null;
  source: AssetSourceInfo | null;
  jobs: IngestJobSummary[];
  chunks: AssetChunkSummary[];
}
