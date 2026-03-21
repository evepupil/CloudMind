import type {
  AssetChunkMatch,
  AssetSummary,
} from "@/features/assets/model/types";

export type ContextResultScope = "preferred_only" | "fallback_expanded";

export interface SearchChunkResultItem {
  kind: "chunk";
  score: number;
  chunk: AssetChunkMatch;
}

export interface SearchSummaryResultItem {
  kind: "summary";
  score: number;
  asset: AssetSummary;
  summary: string;
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
  pagination: SearchPagination;
  resultScope?: ContextResultScope | undefined;
}
