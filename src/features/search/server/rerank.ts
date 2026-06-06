import type { AIProvider } from "@/core/ai/ports";
import type { EvidenceItem } from "@/features/search/model/evidence";

// 重排窗口：只对融合后 top-N 候选跑 cross-encoder，平衡质量与延迟/成本。
export const DEFAULT_RERANK_TOP_N = 40;
// MMR 权衡：λ 越大越偏相关性、越小越偏多样性。0.7 偏相关性但仍压制近重复。
export const DEFAULT_MMR_LAMBDA = 0.7;

export interface RerankEvidenceOptions {
  topN?: number | undefined;
  mmrLambda?: number | undefined;
}

// 这里把文本切成"英文/数字词 + 中文单字"的 token 集合，供 MMR 的 Jaccard 相似度用。
// 中文按字粒度算重叠，避免引入分词依赖；近重复段落会共享大量字符从而被识别。
export const tokenizeForSimilarity = (text: string): Set<string> => {
  const lower = text.toLowerCase();
  const tokens = new Set<string>();

  for (const match of lower.matchAll(/[a-z0-9]+/g)) {
    if (match[0].length >= 2) {
      tokens.add(match[0]);
    }
  }
  for (const match of lower.matchAll(/[一-鿿]/g)) {
    tokens.add(match[0]);
  }

  return tokens;
};

export const jaccardSimilarity = (
  left: Set<string>,
  right: Set<string>
): number => {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }
  const union = left.size + right.size - intersection;

  return union === 0 ? 0 : intersection / union;
};

interface MmrEntry<T> {
  item: T;
  relevance: number;
  tokens: Set<string>;
}

// 贪心 Maximal Marginal Relevance：每步选 λ·相关性 −(1−λ)·与已选集合的最大相似度 最大者。
export const applyMmr = <T>(
  entries: MmrEntry<T>[],
  lambda: number
): MmrEntry<T>[] => {
  const selected: MmrEntry<T>[] = [];
  const remaining = [...entries];

  while (remaining.length > 0) {
    let best: MmrEntry<T> | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const candidate of remaining) {
      const maxSimilarity =
        selected.length === 0
          ? 0
          : Math.max(
              ...selected.map((chosen) =>
                jaccardSimilarity(candidate.tokens, chosen.tokens)
              )
            );
      const mmrScore =
        lambda * candidate.relevance - (1 - lambda) * maxSimilarity;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        best = candidate;
      }
    }

    if (!best) {
      break;
    }
    selected.push(best);
    remaining.splice(remaining.indexOf(best), 1);
  }

  return selected;
};

// 对融合后的证据做 cross-encoder 重排 + MMR 多样化。
// 失败（无 rerank 能力 / 模型报错 / 空结果）一律优雅退回原融合顺序，绝不抛 500。
export const rerankEvidence = async (
  aiProvider: Pick<AIProvider, "rerank">,
  query: string,
  items: EvidenceItem[],
  options?: RerankEvidenceOptions
): Promise<EvidenceItem[]> => {
  const rerank = aiProvider.rerank?.bind(aiProvider);

  if (!rerank || items.length <= 1) {
    return items;
  }

  const topN = Math.min(options?.topN ?? DEFAULT_RERANK_TOP_N, items.length);
  const lambda = options?.mmrLambda ?? DEFAULT_MMR_LAMBDA;
  const head = items.slice(0, topN);
  const tail = items.slice(topN);

  let rerankResults: Awaited<ReturnType<NonNullable<AIProvider["rerank"]>>>;
  try {
    rerankResults = await rerank({
      query,
      documents: head.map((item) => item.text),
    });
  } catch {
    return items;
  }

  const valid = rerankResults.filter(
    (result) => result.index >= 0 && result.index < head.length
  );
  if (valid.length === 0) {
    return items;
  }

  // 把 rerank 原始分 min-max 归一化到 [0,1]，作为 MMR 的相关性。
  const scores = valid.map((result) => result.score);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const range = max - min;
  const relevanceByIndex = new Map<number, number>();
  for (const result of valid) {
    relevanceByIndex.set(
      result.index,
      range > 0 ? (result.score - min) / range : 1
    );
  }

  const mmrOrdered = applyMmr(
    head.map((item, index) => ({
      item,
      // 未被 rerank 覆盖的 head 项给 0 相关性，自然沉到后面。
      relevance: relevanceByIndex.get(index) ?? 0,
      tokens: tokenizeForSimilarity(item.text),
    })),
    lambda
  );

  // 最终顺序 = MMR 重排后的 head + 原序 tail；统一赋降序分数，
  // 保证 head 全部高于 tail，且分组(buildGroupedEvidence)尊重该次序。
  const ordered = [...mmrOrdered.map((entry) => entry.item), ...tail];
  const total = ordered.length;

  return ordered.map((item, index) => ({
    ...item,
    score: total > 0 ? (total - index) / total : item.score,
  }));
};
