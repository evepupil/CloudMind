import type {
  AssetTermMatchItem,
  FacetTermRef,
} from "@/features/assets/model/types";
import type { SearchTermItem } from "./term-service";

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const getTermKey = (term: FacetTermRef): string =>
  `${term.facetKey}:${term.facetValue}`;

const getSearchTermKey = (term: SearchTermItem): string =>
  `${term.kind}:${term.normalized}`;

// 这里让 term 命中作为额外召回源参与主搜索，但分数上弱于 chunk 主召回。
export const scoreAssetTermMatch = (
  rankedTerms: SearchTermItem[],
  item: AssetTermMatchItem
): number => {
  const termScoreMap = new Map(
    rankedTerms.map((term) => [getSearchTermKey(term), term.score])
  );
  const matchedScores = item.matchedTerms
    .map((term) => termScoreMap.get(getTermKey(term)) ?? 0)
    .filter((score) => score > 0)
    .sort((left, right) => right - left);
  const topScore = matchedScores[0] ?? 0.35;
  const secondScore = matchedScores[1] ?? 0;
  const coverageBonus = Math.min(item.matchedTerms.length, 3) * 0.03;
  const priorityScore = clamp(
    (item.asset.retrievalPriority + 20) / 100,
    0,
    1
  );

  return clamp(
    0.18 +
      topScore * 0.42 +
      secondScore * 0.12 +
      coverageBonus +
      priorityScore * 0.06,
    0,
    0.82
  );
};
