import type {
  AppliedRecordFilters,
  RecordFilterInput,
} from "@/core/records/filters";
import type {
  EvidenceLayer,
  EvidencePacket,
  GroupedEvidenceGroup,
} from "@/features/search/model/evidence";
import type { ContextResultScope } from "@/features/search/model/types";

export interface ChatSource {
  sourceType: EvidenceLayer;
  assetId: string;
  chunkId?: string | undefined;
  title: string;
  sourceUrl: string | null;
  snippet: string;
}

export interface AskLibraryIndexingSummary {
  matchedLayers: Array<ChatSource["sourceType"]>;
  domains: string[];
  documentClasses: string[];
  sourceKinds: string[];
  sourceHosts: string[];
  collections: string[];
  topics: string[];
}

export interface AskLibraryInput extends RecordFilterInput {
  question: string;
  topK?: number | undefined;
}

export interface AskLibraryResult {
  answer: string;
  sources: ChatSource[];
  evidence: EvidencePacket;
  groupedEvidence: GroupedEvidenceGroup[];
  appliedRecordFilters?: AppliedRecordFilters | undefined;
  indexingSummary?: AskLibraryIndexingSummary | undefined;
  resultScope?: ContextResultScope | undefined;
}
