import type { MemoryScope } from "@/core/memory/scope";
import type { AssetDomain } from "@/features/assets/model/types";
import type { EvidenceItem } from "@/features/search/model/evidence";
import type {
  RecalledMemory,
  SearchResult,
} from "@/features/search/model/types";

// recall 默认整捆上限与每个子查询的取数；多子查询合并去重后截断到 limit。
export const DEFAULT_RECALL_LIMIT = 20;
export const RECALL_PER_QUERY_PAGE_SIZE = 10;

// recall 排序模式：relevance=语义相关优先（默认）；recency=最近创建优先（"最近发生了什么"）。
export type RecallOrder = "relevance" | "recency";

export interface RecallMemoriesInput {
  queries: string[];
  domain?: AssetDomain | undefined;
  limit?: number | undefined;
  // 已规范化的 ISO datetime 时间窗（调用方负责把「最近/上周/去年」翻译成绝对范围）。
  createdAtFrom?: string | undefined;
  createdAtTo?: string | undefined;
  order?: RecallOrder | undefined;
  // 显式指定检索 scope（recall_agent 传 agent）；不传默认 personal（日常 recall）。
  scopeId?: MemoryScope | undefined;
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
    createdAt: item.asset.createdAt,
    matchedQueries: [query],
  },
});

// 纯函数：把多个子查询的检索证据合并去重为一捆记忆。
// 同一证据被多个子查询命中时保留最高分、并累计 matchedQueries（保留首见的 snippet/title）；
// 最后按 order（relevance 分数 / recency 时间）排序并截断到 limit。
export const mergeRecallResults = (
  perQuery: PerQueryRecall[],
  limit: number,
  order: RecallOrder = "relevance"
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

  // recency：按 createdAt 倒序（ISO 字典序=时间序），同刻用相关分兜底；relevance：纯按分数。
  const compare =
    order === "recency"
      ? (left: RecalledMemory, right: RecalledMemory): number =>
          right.createdAt.localeCompare(left.createdAt) ||
          right.score - left.score
      : (left: RecalledMemory, right: RecalledMemory): number =>
          right.score - left.score;

  return [...byKey.values()].sort(compare).slice(0, Math.max(0, limit));
};
