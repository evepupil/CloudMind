import type {
  AssetChunkMatch,
  AssetDomain,
  AssetSourceKind,
  AssetSummary,
} from "@/features/assets/model/types";
import type {
  EvidenceIndexingView,
  EvidenceLayer,
  EvidencePacket,
  GroupedEvidenceGroup,
} from "@/features/search/model/evidence";

export type ContextResultScope = "preferred_only" | "fallback_expanded";

export type SearchResultIndexingView = EvidenceIndexingView;

export interface SearchChunkResultItem {
  kind: "chunk";
  score: number;
  chunk: AssetChunkMatch;
  indexing: SearchResultIndexingView;
}

export interface SearchSummaryResultItem {
  kind: "summary";
  score: number;
  asset: AssetSummary;
  summary: string;
  indexing: SearchResultIndexingView;
}

export type SearchResultItem = SearchChunkResultItem | SearchSummaryResultItem;

export interface SearchPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SearchResult {
  items: SearchResultItem[];
  evidence: EvidencePacket;
  groupedEvidence: GroupedEvidenceGroup[];
  pagination: SearchPagination;
  resultScope?: ContextResultScope | undefined;
}

// recall 动词的读模型：一条召回的记忆片段。
// kind 直接用证据层（chunk / summary / statement），避免把 L2 图事实压成 summary 而互相去重。
// 与 SearchResultItem 不同，它是「整捆返回」友好的扁平形状，并记录命中了哪些子查询。
export interface RecalledMemory {
  assetId: string;
  title: string;
  snippet: string;
  score: number;
  kind: EvidenceLayer;
  domain: AssetDomain;
  sourceKind: AssetSourceKind | null;
  matchedQueries: string[];
}

export interface RecallResult {
  queries: string[];
  memories: RecalledMemory[];
  total: number;
}
