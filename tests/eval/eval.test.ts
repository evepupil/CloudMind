import { describe, expect, it } from "vitest";

import { formatStagedReport, runStagedEval } from "./harness";

// P1 收尾棘轮（P1-T9）：金标准集扩至 25 条（+2 过滤正确性 +3 多样性/CJK 多相关）。
// 阈值锁在完整管线（reranked 阶段）的 post-P1 实测值，留浮点/重排容差；
// P2+ 任何检索回归只要把 reranked 指标拉低于此即报红。
// 注意：离线 embedder 是确定性 token-hash 替身，本 eval 是排序"接线"的回归门禁，
// 不是语义质量的绝对证明（语义增益靠真环境冒烟，见 architecture 文档）。
// post-P1 实测（reranked 阶段，n=25）：R@10=1.0000 MRR=0.9800 nDCG@10=0.9852 MAP=0.9800。
// 已高于 P1-T0 旧基线（MRR0.9750/nDCG0.9815/MAP0.9750），确定性可复现，故按实测值锁死。
const BASELINE = {
  recallAtK: 1.0,
  mrr: 0.98,
  ndcgAt10: 0.985,
  map: 0.98,
};

describe("retrieval eval (golden set)", () => {
  it("meets or exceeds the post-P1 ratchet across the staged pipeline", async () => {
    const report = await runStagedEval();

    // 用 process.stdout.write 而非 console.log：vitest run 模式会拦截 console。
    process.stdout.write(`\n${formatStagedReport(report)}\n\n`);

    const reranked = report.stages.reranked.aggregate;
    const fused = report.stages.fused.aggregate;

    expect(reranked.count).toBeGreaterThanOrEqual(25);
    expect(reranked.recallAtK).toBeGreaterThanOrEqual(BASELINE.recallAtK);
    expect(reranked.mrr).toBeGreaterThanOrEqual(BASELINE.mrr);
    expect(reranked.ndcgAt10).toBeGreaterThanOrEqual(BASELINE.ndcgAt10);
    expect(reranked.map).toBeGreaterThanOrEqual(BASELINE.map);

    // rerank 不得劣化融合排序（容浮点）。
    expect(reranked.mrr).toBeGreaterThanOrEqual(fused.mrr - 1e-9);
    expect(reranked.ndcgAt10).toBeGreaterThanOrEqual(fused.ndcgAt10 - 1e-9);

    // 过滤正确性：完整管线对带 domain 过滤的金标准零违例。
    expect(reranked.filterViolations).toBe(0);
  });
});
