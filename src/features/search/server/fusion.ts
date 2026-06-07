import type { EvidenceItem } from "@/features/search/model/evidence";

// 各通道权重：dense（chunk）语义最可信，lexical 通道略低，
// 使同为通道内最高分时 chunk 胜出，从而修正"蹭关键词的 assertion 压过真正语义 chunk"的旧缺陷。
export const FUSION_CHANNEL_WEIGHTS = {
  chunk: 1.0,
  // FTS5/BM25 词面 chunk 通道：略低于 dense，但高于 summary，作为中文/精确关键词的召回补充。
  lexicalChunk: 0.9,
  summary: 0.85,
  // L2 图检索通道：实体多跳关联召回的事实证据，权重介于 lexicalChunk 与 summary 之间，
  // 既能把图关联资产带进结果，又不至于压过直接语义命中的 chunk。
  graph: 0.88,
} as const;

// 这里对单个通道内的分数做 min-max 归一化到 [0,1]，再乘通道权重。
// 取代旧的"跨通道原始分硬排序"：
//   - 归一化消除了 lexical scoring 的 0.38/0.89/0.93/0.82 等绝对 floor/ceiling 对跨通道排序的影响；
//   - 同时保留通道内的相对量纲差异（强 chunk 仍明显强于弱 chunk），避免纯 rank 融合把量纲拍平。
// 通道内只有一个候选时归一化为 1（即该通道最优）。
export const normalizeChannelScores = (
  items: EvidenceItem[],
  weight: number
): EvidenceItem[] => {
  if (items.length === 0) {
    return [];
  }

  const scores = items.map((item) => item.score);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const range = max - min;

  return items.map((item) => {
    const normalized = range > 0 ? (item.score - min) / range : 1;

    return { ...item, score: normalized * weight };
  });
};
