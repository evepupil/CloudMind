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

// 这里约束资产的粗粒度领域，先服务检索分区与访问策略。
export type AssetDomain =
  | "engineering"
  | "product"
  | "research"
  | "personal"
  | "finance"
  | "health"
  | "archive"
  | "general";

// 这里区分敏感级别，供 AI 可见性与后续权限边界复用。
export type AssetSensitivity = "public" | "internal" | "private" | "restricted";

// 这里表达 AI 在读取资产时的可见范围。
export type AssetAiVisibility = "allow" | "summary_only" | "deny";

// 这里描述资产级文档形态，用于补足 domain 粒度。
export type AssetDocumentClass =
  | "reference_doc"
  | "design_doc"
  | "bug_note"
  | "paper"
  | "journal_entry"
  | "meeting_note"
  | "spec"
  | "howto"
  | "general_note";

// 这里约束 facet 维度，避免切面无限扩张。
export type AssetFacetKey =
  | "domain"
  | "document_class"
  | "asset_type"
  | "source_kind"
  | "collection"
  | "source_host"
  | "year"
  | "topic"
  | "tag"
  | "ai_visibility"
  | "sensitivity";

// 这里先限制 assertion 类型，保证第一版稳定可控。
export type AssetAssertionKind =
  | "fact"
  | "decision"
  | "constraint"
  | "summary_point";

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

export type AssetDeletedFilter = "exclude" | "only" | "include";

export interface AssetSearchFilters {
  type?: AssetType | undefined;
  domain?: AssetDomain | undefined;
  documentClass?: AssetDocumentClass | undefined;
  sourceKind?: AssetSourceKind | undefined;
  createdAtFrom?: string | undefined;
  createdAtTo?: string | undefined;
  sourceHost?: string | undefined;
  topic?: string | undefined;
  tag?: string | undefined;
  collection?: string | undefined;
}

export interface AssetListQuery extends AssetSearchFilters {
  deleted?: AssetDeletedFilter | undefined;
  status?: AssetStatus | undefined;
  aiVisibility?: AssetAiVisibility | undefined;
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
  sourceKind: AssetSourceKind | null;
  status: AssetStatus;
  domain: AssetDomain;
  sensitivity: AssetSensitivity;
  aiVisibility: AssetAiVisibility;
  retrievalPriority: number;
  documentClass?: AssetDocumentClass | null | undefined;
  sourceHost?: string | null | undefined;
  collectionKey: string | null;
  capturedAt: string | null;
  descriptorJson: string | null;
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
  contentText?: string | null;
  vectorId: string | null;
}

export interface AssetChunkMatch extends AssetChunkSummary {
  asset: AssetSummary;
}

export interface AssetSummaryMatch {
  asset: AssetSummary;
  summary: string;
}

export interface AssetFacetSummary {
  id: string;
  facetKey: AssetFacetKey;
  facetValue: string;
  facetLabel: string;
  sortOrder: number;
}

export interface AssetAssertionSummary {
  id: string;
  assertionIndex: number;
  kind: AssetAssertionKind;
  text: string;
  sourceChunkIndex: number | null;
  sourceSpanJson: string | null;
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetAssertionMatch extends AssetAssertionSummary {
  asset: AssetSummary;
}

// term 反查：记录单个 term 命中信息。
export interface FacetTermRef {
  facetKey: "topic" | "tag" | "collection";
  facetValue: string;
}

// term 反查：带分页的查询输入。
export interface AssetFacetTermQuery {
  terms: FacetTermRef[];
  aiVisibility?: AssetAiVisibility[] | undefined;
  filters?: AssetSearchFilters | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

// term 反查：单个资产的 term 命中结果。
export interface AssetTermMatchItem {
  asset: AssetSummary;
  matchedTerms: FacetTermRef[];
}

// term 反查：完整查询结果。
export interface AssetFacetTermResult {
  items: AssetTermMatchItem[];
  pagination: PaginationInfo;
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
  facets?: AssetFacetSummary[] | undefined;
  assertions?: AssetAssertionSummary[] | undefined;
}
