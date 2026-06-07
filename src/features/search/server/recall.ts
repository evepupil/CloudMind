import type { AssetDomain } from "@/features/assets/model/types";
import type { EvidenceItem } from "@/features/search/model/evidence";
import type {
  RecalledMemory,
  SearchResult,
} from "@/features/search/model/types";

// recall 默认整捆上限与每个子查询的取数；多子查询合并去重后截断到 limit。
export const DEFAULT_RECALL_LIMIT = 20;
export const RECALL_PER_QUERY_PAGE_SIZE = 10;

export interface RecallMemoriesInput {
  queries: string[];
  domain?: AssetDomain | undefined;
  limit?: number | undefined;
}

// 单个子查询的检索结果，连同发起它的子查询文本一起带回，便于记录 matchedQueries。
export interface PerQueryRecall {
  query: string;
  result: SearchResult;
}

// 把一条证据项映射为扁平记忆，并给出去重 key。
// 直接用 EvidenceItem.id（chunk:<chunkId> / summary:<assetId> / statement:<stmtId>:<assetId>）——
// 三种层天然不互撞，从而避免「同资产多条 L2 事实被压成一条 summary 而互相吞掉」的缺陷。
const toRecalledMemory = (
  item: EvidenceItem,
  query: string
): { key: string; memory: RecalledMemory } => ({
  key: item.id,
  memory: {
    assetId: item.asset.id,
    title: item.asset.title,
    // chunk 用预览片段；summary/statement 用完整文本（与 toSearchResultItem 的取值一致）。
    snippet: item.layer === "chunk" ? item.snippet : item.text,
    score: item.score,
    kind: item.layer,
    domain: item.asset.domain,
    sourceKind: item.asset.sourceKind,
    matchedQueries: [query],
  },
});

// 纯函数：把多个子查询的检索证据合并去重为一捆记忆。
// 同一证据被多个子查询命中时保留最高分、并累计 matchedQueries（保留首见的 snippet/title）；
// 最后按分数降序截断到 limit。
export const mergeRecallResults = (
  perQuery: PerQueryRecall[],
  limit: number
): RecalledMemory[] => {
  const byKey = new Map<string, RecalledMemory>();

  for (const { query, result } of perQuery) {
    for (const item of result.evidence.items) {
      const { key, memory } = toRecalledMemory(item, query);
      const existing = byKey.get(key);

      if (!existing) {
        byKey.set(key, memory);
        continue;
      }

      existing.score = Math.max(existing.score, memory.score);

      if (!existing.matchedQueries.includes(query)) {
        existing.matchedQueries.push(query);
      }
    }
  }

  return [...byKey.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(0, limit));
};
