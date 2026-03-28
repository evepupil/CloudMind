import type { AIProvider } from "@/core/ai/ports";
import type { CreateAssetFacetInput } from "@/core/assets/ports";
import type { VectorStore } from "@/core/vector/ports";
import { createLogger } from "@/platform/observability/logger";

const METADATA_TERM_NAMESPACE = "metadata_terms";
const metadataTermLogger = createLogger("metadata_terms");

type MetadataTermKind = "topic" | "tag" | "catalog";

interface MetadataTermSearchResult {
  kind: MetadataTermKind;
  term: string;
  normalized: string;
  score: number;
}

interface ParsedTermMetadata {
  kind: MetadataTermKind;
  term: string;
  normalized: string;
}

const normalizeTerm = (value: string): string => {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
};

const createTermVectorId = (
  kind: MetadataTermKind,
  normalized: string
): string => {
  return `term:${kind}:${normalized}`;
};

const mapFacetKeyToTermKind = (
  facetKey: CreateAssetFacetInput["facetKey"]
): MetadataTermKind | null => {
  if (facetKey === "topic") {
    return "topic";
  }

  if (facetKey === "tag") {
    return "tag";
  }

  if (facetKey === "collection") {
    return "catalog";
  }

  return null;
};

const parseTermMetadata = (
  metadataJson: string | undefined
): ParsedTermMetadata | null => {
  if (!metadataJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadataJson) as Partial<ParsedTermMetadata>;

    if (
      !parsed ||
      (parsed.kind !== "topic" &&
        parsed.kind !== "tag" &&
        parsed.kind !== "catalog") ||
      typeof parsed.term !== "string" ||
      typeof parsed.normalized !== "string"
    ) {
      return null;
    }

    return {
      kind: parsed.kind,
      term: parsed.term,
      normalized: parsed.normalized,
    };
  } catch {
    return null;
  }
};

const collectFacetTerms = (facets: CreateAssetFacetInput[]) => {
  const uniqueTerms = new Map<
    string,
    {
      kind: MetadataTermKind;
      term: string;
      normalized: string;
    }
  >();

  for (const facet of facets) {
    const kind = mapFacetKeyToTermKind(facet.facetKey);

    if (!kind) {
      continue;
    }

    const normalized = normalizeTerm(facet.facetValue);

    if (!normalized) {
      continue;
    }

    const key = `${kind}:${normalized}`;

    if (uniqueTerms.has(key)) {
      continue;
    }

    uniqueTerms.set(key, {
      kind,
      term: facet.facetValue.trim(),
      normalized,
    });
  }

  return [...uniqueTerms.values()];
};

// 这里把 topic/tag/catalog 词项同步到独立命名空间，供保存前复用查询。
export const upsertMetadataTermVectors = async (
  vectorStore: VectorStore,
  aiProvider: AIProvider,
  facets: CreateAssetFacetInput[]
): Promise<void> => {
  const terms = collectFacetTerms(facets);

  if (terms.length === 0) {
    return;
  }

  try {
    const embeddingsResult = await aiProvider.createEmbeddings({
      texts: terms.map((term) => term.term),
      purpose: "document",
    });

    if (embeddingsResult.embeddings.length !== terms.length) {
      return;
    }

    await vectorStore.upsert(
      terms.map((term, index) => ({
        id: createTermVectorId(term.kind, term.normalized),
        values: embeddingsResult.embeddings[index] ?? [],
        namespace: METADATA_TERM_NAMESPACE,
        metadataJson: JSON.stringify({
          kind: term.kind,
          term: term.term,
          normalized: term.normalized,
        }),
      }))
    );
  } catch (error) {
    metadataTermLogger.warn(
      "upsert_skipped",
      {
        termCount: terms.length,
      },
      {
        error,
      }
    );
  }
};

// 这里查询词项近邻，优先复用已有 topic/tag/catalog，避免词表无序膨胀。
export const searchMetadataTerms = async (
  vectorStore: VectorStore,
  aiProvider: AIProvider,
  kind: MetadataTermKind,
  queryText: string,
  topK = 8
): Promise<MetadataTermSearchResult[]> => {
  const normalizedQuery = normalizeTerm(queryText);

  if (!normalizedQuery) {
    return [];
  }

  const embeddingResult = await aiProvider.createEmbeddings({
    texts: [queryText],
    purpose: "query",
  });
  const queryVector = embeddingResult.embeddings[0];

  if (!queryVector) {
    return [];
  }

  const matches = await vectorStore.search({
    values: queryVector,
    topK: Math.max(topK * 4, 12),
    namespace: METADATA_TERM_NAMESPACE,
  });

  const unique = new Set<string>();
  const results: MetadataTermSearchResult[] = [];

  for (const match of matches) {
    const metadata = parseTermMetadata(match.metadataJson);

    if (!metadata || metadata.kind !== kind) {
      continue;
    }

    const dedupeKey = `${metadata.kind}:${metadata.normalized}`;

    if (unique.has(dedupeKey)) {
      continue;
    }

    unique.add(dedupeKey);
    results.push({
      kind: metadata.kind,
      term: metadata.term,
      normalized: metadata.normalized,
      score: match.score,
    });

    if (results.length >= topK) {
      break;
    }
  }

  return results;
};
