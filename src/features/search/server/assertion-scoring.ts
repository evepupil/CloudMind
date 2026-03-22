import type { AssetAssertionMatch } from "@/features/assets/model/types";

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

// 这里给 assertion 结果一个稳定启发式分数，便于与 summary / chunk 融合排序。
export const scoreAssetAssertionMatch = (
  query: string,
  match: AssetAssertionMatch
): number => {
  const terms = tokenizeQuery(query);
  const title = normalizeText(match.asset.title);
  const assertion = normalizeText(match.text);
  const combined = [title, assertion].filter(Boolean).join("\n");

  if (!combined) {
    return 0.25;
  }

  if (terms.length === 0) {
    return 0.45;
  }

  const matchedTerms = countMatchedTerms(combined, terms);
  const matchedInTitle = countMatchedTerms(title, terms);
  const exactQueryBonus = combined.includes(normalizeText(query)) ? 0.1 : 0;
  const termScore = matchedTerms / terms.length;
  const titleScore = matchedInTitle / terms.length;
  const confidenceScore = clamp(match.confidence ?? 0.7, 0, 1) * 0.12;
  const priorityScore = clamp(
    (match.asset.retrievalPriority + 20) / 100,
    0,
    1
  );

  return clamp(
    0.38 +
      termScore * 0.26 +
      titleScore * 0.1 +
      confidenceScore +
      priorityScore * 0.08 +
      exactQueryBonus,
    0,
    0.93
  );
};
