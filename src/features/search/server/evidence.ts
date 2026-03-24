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

const EVIDENCE_LAYER_PRIORITY: Record<EvidenceLayer, number> = {
  chunk: 3,
  assertion: 2,
  summary: 1,
};

const normalizeEvidenceText = (value: string): string => {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
};

const compareEvidenceItems = (
  left: EvidenceItem,
  right: EvidenceItem
): number => {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return (
    EVIDENCE_LAYER_PRIORITY[right.layer] - EVIDENCE_LAYER_PRIORITY[left.layer]
  );
};

export const buildGroupedEvidence = (items: EvidenceItem[]) => {
  const grouped = new Map<
    string,
    {
      asset: EvidenceItem["asset"];
      matchedLayers: Set<EvidenceLayer>;
      items: EvidenceItem[];
      topScore: number;
      seenKeys: Set<string>;
    }
  >();

  for (const item of items) {
    const existingGroup = grouped.get(item.asset.id);
    const dedupeKey = [
      item.asset.id,
      item.layer,
      normalizeEvidenceText(item.text).slice(0, 240),
    ].join(":");

    if (!existingGroup) {
      grouped.set(item.asset.id, {
        asset: item.asset,
        matchedLayers: new Set([item.layer]),
        items: [item],
        topScore: item.score,
        seenKeys: new Set([dedupeKey]),
      });
      continue;
    }

    existingGroup.matchedLayers.add(item.layer);
    existingGroup.topScore = Math.max(existingGroup.topScore, item.score);

    if (existingGroup.seenKeys.has(dedupeKey)) {
      continue;
    }

    existingGroup.seenKeys.add(dedupeKey);
    existingGroup.items.push(item);
  }

  return Array.from(grouped.values())
    .map((group) => ({
      asset: group.asset,
      topScore: group.topScore,
      matchedLayers: Array.from(group.matchedLayers).sort(
        (left, right) =>
          EVIDENCE_LAYER_PRIORITY[right] - EVIDENCE_LAYER_PRIORITY[left]
      ),
      items: [...group.items].sort(compareEvidenceItems),
    }))
    .sort((left, right) => {
      if (right.topScore !== left.topScore) {
        return right.topScore - left.topScore;
      }

      return right.items.length - left.items.length;
    });
};

export const buildEvidencePacket = (items: EvidenceItem[]) => {
  return {
    items,
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
