import type {
  AssetAssertionKind,
  AssetAssertionMatch,
  AssetChunkMatch,
  AssetSummary,
} from "@/features/assets/model/types";

export type ContextResultScope = "preferred_only" | "fallback_expanded";

export interface SearchResultIndexingView {
  matchedLayer: "chunk" | "assertion" | "summary";
  domain: AssetSummary["domain"];
  documentClass: AssetSummary["documentClass"] | null;
  sourceHost: string | null;
  collectionKey: string | null;
  aiVisibility: AssetSummary["aiVisibility"];
  sourceKind: AssetSummary["sourceKind"] | null;
  topics: string[];
  assertionKind?: AssetAssertionKind | null | undefined;
}

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
  pagination: SearchPagination;
  resultScope?: ContextResultScope | undefined;
}
