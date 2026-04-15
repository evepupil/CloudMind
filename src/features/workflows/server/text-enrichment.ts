import type { AssetDetail } from "@/features/assets/model/types";
import {
  assetDomainValues,
  type TextAssetEnrichmentInput,
} from "@/features/ingest/model/enrichment";

import type { AssetDescriptor } from "./indexing-policy";

const defaultDocumentClassByAssetType: Record<
  AssetDetail["type"],
  AssetDescriptor["documentClass"]
> = {
  note: "general_note",
  chat: "general_note",
  url: "reference_doc",
  pdf: "reference_doc",
  image: "reference_doc",
};

const defaultDomain = assetDomainValues.at(-1) ?? "general";

const normalizeUniqueStrings = (values: string[] | undefined): string[] => {
  if (!values?.length) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
};

export const mergeDescriptorWithEnrichment = (
  descriptor: AssetDescriptor,
  enrichment: TextAssetEnrichmentInput | null
): AssetDescriptor => {
  if (!enrichment) {
    return descriptor;
  }

  const topics = normalizeUniqueStrings(enrichment.descriptor?.topics);
  const tags = normalizeUniqueStrings(enrichment.descriptor?.tags);
  const signals = normalizeUniqueStrings(enrichment.descriptor?.signals);
  const hasSemanticHints =
    enrichment.domain !== undefined ||
    enrichment.documentClass !== undefined ||
    topics.length > 0 ||
    tags.length > 0;

  if (!hasSemanticHints) {
    return {
      ...descriptor,
      collectionKey:
        enrichment.descriptor?.collectionKey ?? descriptor.collectionKey,
      signals: signals.length > 0 ? signals : descriptor.signals,
    };
  }

  return {
    ...descriptor,
    domain: enrichment.domain ?? defaultDomain,
    documentClass:
      enrichment.documentClass ??
      defaultDocumentClassByAssetType[descriptor.assetType],
    topics,
    tags,
    collectionKey:
      enrichment.descriptor?.collectionKey ?? descriptor.collectionKey,
    signals: signals.length > 0 ? signals : ["ai_metadata_selected"],
  };
};
