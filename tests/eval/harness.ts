// 这里是离线检索 eval 的执行器：加载金标准查询，跑真实 search service，计算 Recall@k / MRR / nDCG@10 / MAP。
// 无任何 Cloudflare 依赖，可在 CI 中作为检索改动的回归门禁。

import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

import { createSearchService } from "@/features/search/server/service";
import {
  buildEvalDependencies,
  CORPUS,
  type CorpusAsset,
} from "./fixtures/corpus";

export interface GoldenQuery {
  query: string;
  lang: "en" | "zh";
  expectedAssetIds: string[];
  note?: string;
}

export interface QueryEval {
  query: string;
  lang: string;
  rankedAssetIds: string[];
  recallAtK: number;
  mrr: number;
  ndcgAt10: number;
  ap: number;
}

export interface EvalReport {
  k: number;
  perQuery: QueryEval[];
  aggregate: {
    count: number;
    recallAtK: number;
    mrr: number;
    ndcgAt10: number;
    map: number;
  };
}

const recallAtK = (
  ranked: string[],
  relevant: Set<string>,
  k: number
): number => {
  if (relevant.size === 0) {
    return 0;
  }

  let hit = 0;

  for (const id of ranked.slice(0, k)) {
    if (relevant.has(id)) {
      hit += 1;
    }
  }

  return hit / relevant.size;
};

const reciprocalRank = (ranked: string[], relevant: Set<string>): number => {
  for (let i = 0; i < ranked.length; i += 1) {
    const id = ranked[i];

    if (id && relevant.has(id)) {
      return 1 / (i + 1);
    }
  }

  return 0;
};

const ndcgAt = (ranked: string[], relevant: Set<string>, k: number): number => {
  let dcg = 0;
  const limit = Math.min(k, ranked.length);

  for (let i = 0; i < limit; i += 1) {
    const id = ranked[i];

    if (id && relevant.has(id)) {
      dcg += 1 / Math.log2(i + 2);
    }
  }

  let idcg = 0;
  const idealCount = Math.min(k, relevant.size);

  for (let i = 0; i < idealCount; i += 1) {
    idcg += 1 / Math.log2(i + 2);
  }

  return idcg === 0 ? 0 : dcg / idcg;
};

const averagePrecision = (ranked: string[], relevant: Set<string>): number => {
  if (relevant.size === 0) {
    return 0;
  }

  let hits = 0;
  let sum = 0;

  for (let i = 0; i < ranked.length; i += 1) {
    const id = ranked[i];

    if (id && relevant.has(id)) {
      hits += 1;
      sum += hits / (i + 1);
    }
  }

  return sum / relevant.size;
};

export const loadGoldenQueries = (): GoldenQuery[] => {
  const path = fileURLToPath(
    new URL("./golden/queries.jsonl", import.meta.url)
  );

  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as GoldenQuery);
};

export const runEval = async (
  options: { corpus?: CorpusAsset[] | undefined; k?: number | undefined } = {}
): Promise<EvalReport> => {
  const k = options.k ?? 10;
  const corpus = options.corpus ?? CORPUS;
  const service = createSearchService(buildEvalDependencies(corpus));
  const queries = loadGoldenQueries();
  const perQuery: QueryEval[] = [];

  for (const golden of queries) {
    const result = await service.searchAssets(undefined, {
      query: golden.query,
      page: 1,
      pageSize: 20,
    });
    const rankedAssetIds = result.groupedEvidence.map(
      (group) => group.asset.id
    );
    const relevant = new Set(golden.expectedAssetIds);

    perQuery.push({
      query: golden.query,
      lang: golden.lang,
      rankedAssetIds,
      recallAtK: recallAtK(rankedAssetIds, relevant, k),
      mrr: reciprocalRank(rankedAssetIds, relevant),
      ndcgAt10: ndcgAt(rankedAssetIds, relevant, 10),
      ap: averagePrecision(rankedAssetIds, relevant),
    });
  }

  const count = perQuery.length || 1;
  const mean = (selector: (item: QueryEval) => number): number =>
    perQuery.reduce((sum, item) => sum + selector(item), 0) / count;

  return {
    k,
    perQuery,
    aggregate: {
      count: perQuery.length,
      recallAtK: mean((item) => item.recallAtK),
      mrr: mean((item) => item.mrr),
      ndcgAt10: mean((item) => item.ndcgAt10),
      map: mean((item) => item.ap),
    },
  };
};

export const formatReport = (report: EvalReport): string => {
  const lines: string[] = [
    `eval: ${report.aggregate.count} queries, k=${report.k}`,
  ];

  for (const item of report.perQuery) {
    const top = item.rankedAssetIds.slice(0, 3).join(", ");

    lines.push(
      `  [${item.lang}] R@${report.k}=${item.recallAtK.toFixed(2)} MRR=${item.mrr.toFixed(2)} nDCG@10=${item.ndcgAt10.toFixed(2)} AP=${item.ap.toFixed(2)} | ${item.query} -> ${top}`
    );
  }

  const aggregate = report.aggregate;

  lines.push(
    `AGG Recall@${report.k}=${aggregate.recallAtK.toFixed(4)} MRR=${aggregate.mrr.toFixed(4)} nDCG@10=${aggregate.ndcgAt10.toFixed(4)} MAP=${aggregate.map.toFixed(4)}`
  );

  return lines.join("\n");
};
