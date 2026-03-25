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
  EvidenceMatchReason,
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

const buildMatchReason = (
  code: EvidenceMatchReason["code"],
  label: string,
  detail: string
): EvidenceMatchReason => {
  return {
    code,
    label,
    detail,
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
    matchReasons: [
      buildMatchReason(
        "semantic_match",
        "Semantic match",
        "Matched the query against embedded chunk content."
      ),
    ],
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
    matchReasons: [
      buildMatchReason(
        "summary_match",
        "Summary match",
        "Matched the query against the asset summary layer."
      ),
    ],
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
    matchReasons: [
      buildMatchReason(
        "assertion_match",
        "Assertion match",
        "Matched the query against structured assertion text."
      ),
    ],
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

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const getRecencyBonus = (asset: EvidenceItem["asset"]): number => {
  const referenceDate = asset.capturedAt ?? asset.updatedAt ?? asset.createdAt;

  if (!referenceDate) {
    return 0;
  }

  const timestamp = Date.parse(referenceDate);

  if (Number.isNaN(timestamp)) {
    return 0;
  }

  const daysSince = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);

  if (daysSince <= 7) {
    return 0.08;
  }

  if (daysSince <= 30) {
    return 0.04;
  }

  if (daysSince <= 90) {
    return 0.015;
  }

  return 0;
};

const getAssetPriorityBonus = (asset: EvidenceItem["asset"]): number => {
  return clamp(asset.retrievalPriority / 200, -0.12, 0.18);
};

const getRecencyLabel = (daysSince: number): string => {
  if (daysSince <= 7) {
    return "Recent asset";
  }

  if (daysSince <= 30) {
    return "Fresh asset";
  }

  return "Relatively recent asset";
};

const getDaysSinceReferenceDate = (
  asset: EvidenceItem["asset"]
): number | null => {
  const referenceDate = asset.capturedAt ?? asset.updatedAt ?? asset.createdAt;

  if (!referenceDate) {
    return null;
  }

  const timestamp = Date.parse(referenceDate);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
};

const getLayerCoverageBonus = (matchedLayers: Set<EvidenceLayer>): number => {
  const layers = Array.from(matchedLayers);

  if (
    layers.includes("chunk") &&
    layers.includes("assertion") &&
    layers.includes("summary")
  ) {
    return 0.12;
  }

  if (layers.includes("chunk") && layers.includes("assertion")) {
    return 0.08;
  }

  if (layers.includes("chunk") && layers.includes("summary")) {
    return 0.06;
  }

  if (layers.includes("assertion") && layers.includes("summary")) {
    return 0.04;
  }

  return layers.length > 1 ? 0.03 : 0;
};

const getSupportingEvidenceBonus = (itemCount: number): number => {
  return Math.min(Math.max(itemCount - 1, 0), 3) * 0.025;
};

const calculateAssetScore = (group: {
  asset: EvidenceItem["asset"];
  items: EvidenceItem[];
  matchedLayers: Set<EvidenceLayer>;
}): number => {
  const sortedItems = [...group.items].sort(compareEvidenceItems);
  const topScore = sortedItems[0]?.score ?? 0;
  const secondScore = sortedItems[1]?.score ?? 0;

  return Number(
    (
      topScore * 0.72 +
      secondScore * 0.16 +
      getLayerCoverageBonus(group.matchedLayers) +
      getSupportingEvidenceBonus(sortedItems.length) +
      getAssetPriorityBonus(group.asset) +
      getRecencyBonus(group.asset)
    ).toFixed(6)
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
    .map((group) => {
      const orderedItems = [...group.items].sort(compareEvidenceItems);

      return {
        asset: group.asset,
        assetScore: calculateAssetScore({
          asset: group.asset,
          items: orderedItems,
          matchedLayers: group.matchedLayers,
        }),
        topScore: group.topScore,
        matchedLayers: Array.from(group.matchedLayers).sort(
          (left, right) =>
            EVIDENCE_LAYER_PRIORITY[right] - EVIDENCE_LAYER_PRIORITY[left]
        ),
        primaryEvidence: orderedItems[0] as EvidenceItem,
        groupSummary: buildGroupSummary({
          asset: group.asset,
          items: orderedItems,
          matchedLayers: group.matchedLayers,
        }),
        items: orderedItems,
      };
    })
    .sort((left, right) => {
      if (right.assetScore !== left.assetScore) {
        return right.assetScore - left.assetScore;
      }

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

export const annotateEvidenceMatchReasons = (
  item: EvidenceItem,
  options?: {
    profileBoosted?: boolean;
  }
): EvidenceItem => {
  const nextReasons = [...item.matchReasons];

  if (options?.profileBoosted) {
    nextReasons.push(
      buildMatchReason(
        "profile_boosted",
        "Profile boosted",
        "Boosted because the asset domain matches the active context profile."
      )
    );
  }

  if (getAssetPriorityBonus(item.asset) > 0.02) {
    nextReasons.push(
      buildMatchReason(
        "high_priority_asset",
        "High priority asset",
        "Asset retrieval priority lifted this result in ranking."
      )
    );
  }

  const daysSince = getDaysSinceReferenceDate(item.asset);

  if (daysSince !== null && getRecencyBonus(item.asset) > 0) {
    nextReasons.push(
      buildMatchReason(
        "recent_boosted",
        getRecencyLabel(daysSince),
        "Recency contributed to the final ranking of this evidence."
      )
    );
  }

  return {
    ...item,
    matchReasons: nextReasons.filter(
      (reason, index, reasons) =>
        reasons.findIndex((candidate) => candidate.code === reason.code) ===
        index
    ),
  };
};

export const flattenGroupedEvidence = (
  groups: ReturnType<typeof buildGroupedEvidence>
): EvidenceItem[] => {
  return groups.flatMap((group) => group.items);
};

const formatLayersForSummary = (layers: EvidenceLayer[]): string => {
  return layers.map((layer) => layer.replace("_", " ")).join(", ");
};

const buildGroupSummary = (group: {
  asset: EvidenceItem["asset"];
  items: EvidenceItem[];
  matchedLayers: Set<EvidenceLayer>;
}) => {
  const orderedItems = [...group.items].sort(compareEvidenceItems);
  const primaryEvidence = orderedItems[0] as EvidenceItem;
  const bullets = [
    `Primary signal: ${primaryEvidence.matchReasons[0]?.label ?? "Match"}.`,
  ];

  if (group.items.length > 1) {
    bullets.push(`Supported by ${group.items.length} evidence items.`);
  }

  if (group.matchedLayers.size > 1) {
    bullets.push(
      `Matched across multiple layers: ${formatLayersForSummary(
        Array.from(group.matchedLayers).sort(
          (left, right) =>
            EVIDENCE_LAYER_PRIORITY[right] - EVIDENCE_LAYER_PRIORITY[left]
        )
      )}.`
    );
  }

  const extraReasons = primaryEvidence.matchReasons
    .slice(1)
    .map((reason) => reason.label);

  if (extraReasons.length > 0) {
    bullets.push(`Additional boosts: ${extraReasons.join(", ")}.`);
  }

  return {
    headline:
      group.items.length > 1
        ? `${primaryEvidence.matchReasons[0]?.label ?? "Match"} with supporting evidence`
        : `${primaryEvidence.matchReasons[0]?.label ?? "Match"} led this asset`,
    bullets,
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
