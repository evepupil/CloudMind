import type { AIProvider } from "@/core/ai/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { AppBindings } from "@/env";
import { searchMetadataTerms } from "@/features/ingest/server/metadata-terms";
import { getAIProviderFromBindings } from "@/platform/ai/workers-ai/get-ai-provider";
import { getVectorStoreFromBindings } from "@/platform/vector/vectorize/get-vector-store";

export type SearchTermKind = "topic" | "tag" | "collection";

export interface SearchTermsInput {
  query: string;
  kinds?: SearchTermKind[] | undefined;
  topK?: number | undefined;
}

export interface SearchTermItem {
  kind: SearchTermKind;
  term: string;
  normalized: string;
  score: number;
}

export interface SearchTermsResult {
  items: SearchTermItem[];
}

interface TermSearchServiceDependencies {
  getVectorStore: (
    bindings: AppBindings | undefined
  ) => VectorStore | Promise<VectorStore>;
  getAIProvider: (
    bindings: AppBindings | undefined
  ) => AIProvider | Promise<AIProvider>;
}

const defaultDependencies: TermSearchServiceDependencies = {
  getVectorStore: getVectorStoreFromBindings,
  getAIProvider: getAIProviderFromBindings,
};

const defaultKinds: SearchTermKind[] = ["topic", "tag", "collection"];

const normalizeKinds = (
  kinds: SearchTermKind[] | undefined
): SearchTermKind[] => {
  if (!kinds || kinds.length === 0) {
    return defaultKinds;
  }

  return [...new Set(kinds)];
};

const toMetadataTermKind = (
  kind: SearchTermKind
): "topic" | "tag" | "catalog" => {
  if (kind === "collection") {
    return "catalog";
  }

  return kind;
};

// ?????? term ?????? MCP ???????????
export const createTermSearchService = (
  dependencies: TermSearchServiceDependencies = defaultDependencies
) => {
  return {
    async searchTerms(
      bindings: AppBindings | undefined,
      input: SearchTermsInput
    ): Promise<SearchTermsResult> {
      const kinds = normalizeKinds(input.kinds);
      const topK = input.topK ?? 8;
      const [vectorStore, aiProvider] = await Promise.all([
        dependencies.getVectorStore(bindings),
        dependencies.getAIProvider(bindings),
      ]);
      const seen = new Set<string>();
      const items = (
        await Promise.all(
          kinds.map(async (kind) => {
            const matches = await searchMetadataTerms(
              vectorStore,
              aiProvider,
              toMetadataTermKind(kind),
              input.query,
              topK
            );

            return matches.map((match) => ({
              kind,
              term: match.term,
              normalized: match.normalized,
              score: match.score,
            }));
          })
        )
      )
        .flat()
        .filter((item) => {
          const dedupeKey = `${item.kind}:${item.normalized}`;

          if (seen.has(dedupeKey)) {
            return false;
          }

          seen.add(dedupeKey);
          return true;
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, topK);

      return {
        items,
      };
    },
  };
};

const termSearchService = createTermSearchService();

export const { searchTerms } = termSearchService;
