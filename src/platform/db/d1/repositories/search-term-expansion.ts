const SEARCH_ALIASES: Record<string, string[]> = {
  ts: ["typescript"],
  js: ["javascript"],
  cf: ["cloudflare"],
  rag: ["retrieval augmented generation", "retrieval"],
  mcp: ["model context protocol"],
};

export const MAX_SUMMARY_SEARCH_TERMS = 16;
export const MAX_ASSERTION_SEARCH_TERMS = 24;
export const SUMMARY_SEARCH_TERM_BUDGETS = [16, 8, 4] as const;
export const ASSERTION_SEARCH_TERM_BUDGETS = [24, 12, 6] as const;

export const expandSearchTerms = (
  query: string,
  maxTerms = Number.POSITIVE_INFINITY
): string[] => {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  const tokens = normalized
    .split(/[^a-z0-9_]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  const expanded = new Set<string>([normalized]);

  for (const token of tokens) {
    if (expanded.size >= maxTerms) {
      break;
    }

    expanded.add(token);

    if (expanded.size >= maxTerms) {
      break;
    }

    for (const alias of SEARCH_ALIASES[token] ?? []) {
      if (expanded.size >= maxTerms) {
        break;
      }

      expanded.add(alias);
    }
  }

  return Array.from(expanded).slice(0, maxTerms);
};
