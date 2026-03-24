import type {
  AssetAssertionKind,
  AssetSummary,
} from "@/features/assets/model/types";

export type EvidenceLayer = "chunk" | "assertion" | "summary";

export interface EvidenceSourceView {
  sourceUrl: string | null;
  sourceKind: AssetSummary["sourceKind"] | null;
  sourceHost: string | null;
  capturedAt: string | null;
}

export interface EvidenceIndexingView {
  matchedLayer: EvidenceLayer;
  domain: AssetSummary["domain"];
  documentClass: AssetSummary["documentClass"] | null;
  sourceHost: string | null;
  collectionKey: string | null;
  aiVisibility: AssetSummary["aiVisibility"];
  sourceKind: AssetSummary["sourceKind"] | null;
  topics: string[];
  assertionKind?: AssetAssertionKind | null | undefined;
}

export interface EvidenceVisibilityView {
  aiVisibility: AssetSummary["aiVisibility"];
  sensitivity: AssetSummary["sensitivity"];
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
  assertionId?: string | undefined;
  assertionIndex?: number | undefined;
  assertionKind?: AssetAssertionKind | null | undefined;
  confidence?: number | null | undefined;
  sourceChunkIndex?: number | null | undefined;
}

export interface GroupedEvidenceGroup {
  asset: AssetSummary;
  topScore: number;
  matchedLayers: EvidenceLayer[];
  items: EvidenceItem[];
}

export interface EvidencePacket {
  items: EvidenceItem[];
}
