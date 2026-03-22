const SEARCH_ALIASES: Record<string, string[]> = {
  ts: ["typescript"],
  js: ["javascript"],
  cf: ["cloudflare"],
  rag: ["retrieval augmented generation", "retrieval"],
  mcp: ["model context protocol"],
};

export const MAX_SUMMARY_SEARCH_TERMS = 24;
export const MAX_ASSERTION_SEARCH_TERMS = 48;

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
