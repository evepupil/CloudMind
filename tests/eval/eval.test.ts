import { describe, expect, it } from "vitest";

import { formatReport, runEval } from "./harness";

// 这里记录 P1 改动前的基线指标，作为棘轮阈值：
// 后续检索改动（RRF / reranker / FTS5 / prefix 等）只能让聚合指标升、不能降。
// 实测基线（2026-06-05，当前 broken fusion）：Recall@10=1.0000 MRR=0.9750 nDCG@10=0.9815 MAP=0.9750。
// 阈值略低于实测，留出浮点/重排容差；P1 任务收尾（P1-T9）时再向上收紧。
const BASELINE = {
  recallAtK: 1.0,
  mrr: 0.97,
  ndcgAt10: 0.98,
  map: 0.97,
};

describe("retrieval eval (golden set)", () => {
  it("meets or exceeds the recorded baseline", async () => {
    const report = await runEval();

    // 用 process.stdout.write 而非 console.log：vitest run 模式会拦截 console，
    // 直接写 stdout 可保证指标在 CI 输出中可见。
    process.stdout.write(`\n${formatReport(report)}\n\n`);

    expect(report.aggregate.count).toBeGreaterThanOrEqual(20);
    expect(report.aggregate.recallAtK).toBeGreaterThanOrEqual(
      BASELINE.recallAtK
    );
    expect(report.aggregate.mrr).toBeGreaterThanOrEqual(BASELINE.mrr);
    expect(report.aggregate.ndcgAt10).toBeGreaterThanOrEqual(BASELINE.ndcgAt10);
    expect(report.aggregate.map).toBeGreaterThanOrEqual(BASELINE.map);
  });
});
