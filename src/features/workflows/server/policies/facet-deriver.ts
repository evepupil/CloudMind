import type { CreateAssetFacetInput } from "@/core/assets/ports";
import type { AssetFacetKey } from "@/features/assets/model/types";
import {
  type AssetAccessPolicy,
  type AssetDescriptor,
  GENERIC_SEMANTIC_FACET_VALUES,
  normalizeFacetLookupKey,
  normalizeFacetText,
  SEMANTIC_FACET_KEYS,
} from "./types-and-helpers";

type FacetCandidate = Pick<
  CreateAssetFacetInput,
  "facetKey" | "facetValue" | "facetLabel" | "sortOrder"
>;

const pushFacet = (
  facets: CreateAssetFacetInput[],
  facetKey: AssetFacetKey,
  facetValue: string | null | undefined,
  facetLabel: string | null | undefined,
  sortOrder: number
): void => {
  if (!facetValue?.trim() || !facetLabel?.trim()) {
    return;
  }

  facets.push({ facetKey, facetValue, facetLabel, sortOrder });
};

const sanitizeSemanticFacet = (
  facet: FacetCandidate
): FacetCandidate | null => {
  if (!SEMANTIC_FACET_KEYS.has(facet.facetKey)) {
    return null;
  }

  const facetValue = normalizeFacetText(facet.facetValue);
  const facetLabel = normalizeFacetText(facet.facetLabel) || facetValue;

  if (!facetValue || !facetLabel) {
    return null;
  }

  if (
    facet.facetKey !== "collection" &&
    GENERIC_SEMANTIC_FACET_VALUES.has(normalizeFacetLookupKey(facetValue))
  ) {
    return null;
  }

  return {
    facetKey: facet.facetKey,
    facetValue,
    facetLabel,
    sortOrder: facet.sortOrder,
  };
};

const reindexFacets = (
  facets: CreateAssetFacetInput[]
): CreateAssetFacetInput[] => {
  return facets.map((facet, index) => ({
    ...facet,
    sortOrder: index,
  }));
};

export const deriveSystemFacets = (
  descriptor: AssetDescriptor,
  policy: AssetAccessPolicy
): CreateAssetFacetInput[] => {
  const facets: CreateAssetFacetInput[] = [];
  const capturedYear = descriptor.capturedAt?.slice(0, 4) ?? null;

  pushFacet(facets, "domain", descriptor.domain, descriptor.domain, 0);
  pushFacet(
    facets,
    "document_class",
    descriptor.documentClass,
    descriptor.documentClass,
    1
  );
  pushFacet(
    facets,
    "asset_type",
    descriptor.assetType,
    descriptor.assetType,
    2
  );
  pushFacet(
    facets,
    "source_kind",
    descriptor.sourceKind,
    descriptor.sourceKind,
    3
  );
  pushFacet(
    facets,
    "source_host",
    descriptor.sourceHost,
    descriptor.sourceHost,
    4
  );
  pushFacet(facets, "year", capturedYear, capturedYear, 5);
  pushFacet(
    facets,
    "ai_visibility",
    policy.aiVisibility,
    policy.aiVisibility,
    6
  );
  pushFacet(facets, "sensitivity", policy.sensitivity, policy.sensitivity, 7);

  return facets;
};

export const deriveSemanticFacets = (
  descriptor: AssetDescriptor
): CreateAssetFacetInput[] => {
  const facets: CreateAssetFacetInput[] = [];

  pushFacet(
    facets,
    "collection",
    descriptor.collectionKey,
    descriptor.collectionKey,
    20
  );

  for (const [index, topic] of descriptor.topics.entries()) {
    pushFacet(facets, "topic", topic, topic, 30 + index);
  }

  for (const [index, tag] of descriptor.tags.entries()) {
    pushFacet(facets, "tag", tag, tag, 50 + index);
  }

  return facets;
};

const mergeSemanticFacets = (
  baseFacets: CreateAssetFacetInput[],
  clientFacets: ReadonlyArray<FacetCandidate> | null | undefined
): CreateAssetFacetInput[] => {
  const merged: CreateAssetFacetInput[] = [];
  const deduped = new Set<string>();
  let hasCollection = false;

  const tryPush = (facet: FacetCandidate | null) => {
    const sanitized = facet ? sanitizeSemanticFacet(facet) : null;

    if (!sanitized) {
      return;
    }

    if (sanitized.facetKey === "collection") {
      if (hasCollection) {
        return;
      }

      hasCollection = true;
    }

    const dedupeKey = `${sanitized.facetKey}:${normalizeFacetLookupKey(
      sanitized.facetValue
    )}`;

    if (deduped.has(dedupeKey)) {
      return;
    }

    deduped.add(dedupeKey);
    merged.push({
      facetKey: sanitized.facetKey,
      facetValue: sanitized.facetValue,
      facetLabel: sanitized.facetLabel,
      sortOrder: sanitized.sortOrder,
    });
  };

  for (const facet of baseFacets) {
    tryPush(facet);
  }

  for (const facet of clientFacets ?? []) {
    tryPush(facet);
  }

  return merged;
};

export const deriveFacets = (
  descriptor: AssetDescriptor,
  policy: AssetAccessPolicy,
  clientFacets?: ReadonlyArray<FacetCandidate> | null | undefined
): CreateAssetFacetInput[] => {
  return reindexFacets([
    ...deriveSystemFacets(descriptor, policy),
    ...mergeSemanticFacets(deriveSemanticFacets(descriptor), clientFacets),
  ]);
};
