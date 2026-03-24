import type {
  AssetAssertionMatch,
  AssetChunkMatch,
  AssetSummary,
  AssetSummaryMatch,
} from "@/features/assets/model/types";
import type {
  EvidenceIndexingView,
  EvidenceItem,
  EvidenceLayer,
} from "@/features/search/model/evidence";
import type { SearchResultItem } from "@/features/search/model/types";

interface DescriptorTopicsView {
  topics?: string[] | undefined;
}

export const parseDescriptorTopics = (
  descriptorJson: string | null
): string[] => {
  if (!descriptorJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(descriptorJson) as DescriptorTopicsView | null;

    if (!parsed || !Array.isArray(parsed.topics)) {
      return [];
    }

    return parsed.topics.filter(
      (topic: unknown): topic is string => typeof topic === "string"
    );
  } catch {
    return [];
  }
};

export const buildEvidenceIndexing = (
  asset: AssetSummary,
  matchedLayer: EvidenceLayer,
  assertionKind?: EvidenceIndexingView["assertionKind"]
): EvidenceIndexingView => {
  return {
    matchedLayer,
    domain: asset.domain,
    documentClass: asset.documentClass ?? null,
    sourceHost: asset.sourceHost ?? null,
    collectionKey: asset.collectionKey,
    aiVisibility: asset.aiVisibility,
    sourceKind: asset.sourceKind ?? null,
    topics: parseDescriptorTopics(asset.descriptorJson),
    assertionKind: assertionKind ?? null,
  };
};

const buildEvidenceSource = (asset: AssetSummary) => {
  return {
    sourceUrl: asset.sourceUrl,
    sourceKind: asset.sourceKind ?? null,
    sourceHost: asset.sourceHost ?? null,
    capturedAt: asset.capturedAt,
  };
};

const buildEvidenceVisibility = (asset: AssetSummary) => {
  return {
    aiVisibility: asset.aiVisibility,
    sensitivity: asset.sensitivity,
  };
};

export const buildChunkEvidenceItem = (
  chunk: AssetChunkMatch,
  score: number
): EvidenceItem => {
  return {
    id: `chunk:${chunk.id}`,
    layer: "chunk",
    score,
    asset: chunk.asset,
    source: buildEvidenceSource(chunk.asset),
    indexing: buildEvidenceIndexing(chunk.asset, "chunk"),
    visibility: buildEvidenceVisibility(chunk.asset),
    text: chunk.contentText?.trim() || chunk.textPreview,
    snippet: chunk.textPreview,
    chunkId: chunk.id,
    chunkIndex: chunk.chunkIndex,
    vectorId: chunk.vectorId,
  };
};

export const buildSummaryEvidenceItem = (
  match: AssetSummaryMatch,
  score: number
): EvidenceItem => {
  return {
    id: `summary:${match.asset.id}`,
    layer: "summary",
    score,
    asset: match.asset,
    source: buildEvidenceSource(match.asset),
    indexing: buildEvidenceIndexing(match.asset, "summary"),
    visibility: buildEvidenceVisibility(match.asset),
    text: match.summary,
    snippet: match.summary,
  };
};

export const buildAssertionEvidenceItem = (
  match: AssetAssertionMatch,
  score: number
): EvidenceItem => {
  return {
    id: `assertion:${match.id}`,
    layer: "assertion",
    score,
    asset: match.asset,
    source: buildEvidenceSource(match.asset),
    indexing: buildEvidenceIndexing(match.asset, "assertion", match.kind),
    visibility: buildEvidenceVisibility(match.asset),
    text: match.text,
    snippet: match.text,
    assertionId: match.id,
    assertionIndex: match.assertionIndex,
    assertionKind: match.kind,
    confidence: match.confidence,
    sourceChunkIndex: match.sourceChunkIndex,
  };
};

export const toSearchResultItem = (
  evidence: EvidenceItem
): SearchResultItem => {
  if (evidence.layer === "chunk") {
    return {
      kind: "chunk",
      score: evidence.score,
      indexing: evidence.indexing,
      chunk: {
        id: evidence.chunkId ?? evidence.id,
        chunkIndex: evidence.chunkIndex ?? 0,
        textPreview: evidence.snippet,
        contentText: evidence.text,
        vectorId: evidence.vectorId ?? null,
        asset: evidence.asset,
      },
    };
  }

  if (evidence.layer === "assertion") {
    return {
      kind: "assertion",
      score: evidence.score,
      indexing: evidence.indexing,
      assertion: {
        id: evidence.assertionId ?? evidence.id,
        assertionIndex: evidence.assertionIndex ?? 0,
        kind: evidence.assertionKind ?? "fact",
        text: evidence.text,
        sourceChunkIndex: evidence.sourceChunkIndex ?? null,
        sourceSpanJson: null,
        confidence: evidence.confidence ?? null,
        createdAt: evidence.asset.createdAt,
        updatedAt: evidence.asset.updatedAt,
        asset: evidence.asset,
      },
    };
  }

  return {
    kind: "summary",
    score: evidence.score,
    indexing: evidence.indexing,
    asset: evidence.asset,
    summary: evidence.text,
  };
};
