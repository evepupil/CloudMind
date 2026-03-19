import type { AssetChunkMatch } from "@/features/assets/model/types";

export interface SearchResultItem {
  score: number;
  chunk: AssetChunkMatch;
}

export interface SearchPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SearchResult {
  items: SearchResultItem[];
  pagination: SearchPagination;
}
