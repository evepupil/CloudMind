import type { AssetSummaryMatch } from "@/features/assets/model/types";

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const normalizeText = (value: string | null | undefined): string => {
  return value?.trim().toLowerCase() ?? "";
};

const tokenizeQuery = (query: string): string[] => {
  return Array.from(
    new Set(
      normalizeText(query)
        .split(/[\s,.;:!?()[\]{}"'/\\|+-]+/g)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2)
    )
  );
};

const countMatchedTerms = (haystack: string, terms: string[]): number => {
  return terms.filter((term) => haystack.includes(term)).length;
};

// 这里给摘要级结果一个稳定的启发式分数，便于和 chunk 召回结果合并排序。
export const scoreAssetSummaryMatch = (
  query: string,
  match: AssetSummaryMatch
): number => {
  const terms = tokenizeQuery(query);
  const title = normalizeText(match.asset.title);
  const summary = normalizeText(match.summary);
  const sourceUrl = normalizeText(match.asset.sourceUrl);
  const combined = [title, summary, sourceUrl].filter(Boolean).join("\n");

  if (!combined) {
    return 0.2;
  }

  if (terms.length === 0) {
    return 0.35;
  }

  const matchedTerms = countMatchedTerms(combined, terms);
  const matchedInTitle = countMatchedTerms(title, terms);
  const exactQueryBonus = combined.includes(normalizeText(query)) ? 0.1 : 0;
  const termScore = matchedTerms / terms.length;
  const titleScore = matchedInTitle / terms.length;
  const priorityScore = clamp((match.asset.retrievalPriority + 20) / 100, 0, 1);

  return clamp(
    0.32 +
      termScore * 0.32 +
      titleScore * 0.14 +
      priorityScore * 0.12 +
      exactQueryBonus,
    0,
    0.89
  );
};
