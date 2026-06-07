import type { AssetSummary } from "@/features/assets/model/types";

export type EvidenceLayer = "chunk" | "summary";
export type EvidenceMatchReasonCode =
  | "semantic_match"
  | "summary_match"
  | "profile_boosted"
  | "recent_boosted"
  | "high_priority_asset";

export interface EvidenceSourceView {
  sourceUrl: string | null;
  sourceKind: AssetSummary["sourceKind"] | null;
  sourceHost: string | null;
  capturedAt: string | null;
}

export interface EvidenceIndexingView {
  matchedLayer: EvidenceLayer;
  domain: AssetSummary["domain"];
  sourceHost: string | null;
  collectionKey: string | null;
  aiVisibility: AssetSummary["aiVisibility"];
  sourceKind: AssetSummary["sourceKind"] | null;
}

export interface EvidenceVisibilityView {
  aiVisibility: AssetSummary["aiVisibility"];
}

export interface EvidenceMatchReason {
  code: EvidenceMatchReasonCode;
  label: string;
  detail: string;
}

export interface EvidenceItem {
  id: string;
  layer: EvidenceLayer;
  score: number;
  asset: AssetSummary;
  source: EvidenceSourceView;
  indexing: EvidenceIndexingView;
  visibility: EvidenceVisibilityView;
  text: string;
  snippet: string;
  chunkId?: string | undefined;
  chunkIndex?: number | undefined;
  vectorId?: string | null | undefined;
  matchReasons: EvidenceMatchReason[];
}

export interface GroupedEvidenceSummary {
  headline: string;
  bullets: string[];
}

export interface GroupedEvidenceGroup {
  asset: AssetSummary;
  assetScore: number;
  topScore: number;
  matchedLayers: EvidenceLayer[];
  primaryEvidence: EvidenceItem;
  groupSummary: GroupedEvidenceSummary;
  items: EvidenceItem[];
}

export interface EvidencePacket {
  items: EvidenceItem[];
}
