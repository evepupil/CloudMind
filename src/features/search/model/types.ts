import type {
  AssetAssertionMatch,
  AssetChunkMatch,
  AssetSummary,
} from "@/features/assets/model/types";
import type {
  EvidenceIndexingView,
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

export interface SearchAssertionResultItem {
  kind: "assertion";
  score: number;
  assertion: AssetAssertionMatch;
  indexing: SearchResultIndexingView;
}

export type SearchResultItem =
  | SearchChunkResultItem
  | SearchSummaryResultItem
  | SearchAssertionResultItem;

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
