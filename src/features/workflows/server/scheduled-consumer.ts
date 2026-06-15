import { createLogger } from "@/core/logging/logger";
import type { AppBindings } from "@/env";
import { runSleepTimeMaintenance } from "@/features/memory/server/sleep-time";
import { getMemoryRepositoryFromBindings } from "@/platform/db/d1/repositories/get-memory-repository";

const scheduledLogger = createLogger("scheduled");

// Cron 调度入口：装配 D1 记忆仓储并跑 sleep-time 维护（当前为知识图谱一致性修复）。
// 仅 D1 操作、幂等、不依赖 AI/Vectorize；scope 走仓储默认（personal）。失败抛出交平台重试。
export const consumeScheduledEvent = async (
  event: ScheduledController,
  bindings: AppBindings | undefined
): Promise<void> => {
  const startedAt = Date.now();
  const memoryRepository = getMemoryRepositoryFromBindings(bindings);

  try {
    // 不传 scope：交由 D1MemoryRepository 默认 scope（personal）兜底，与写入/检索口径一致。
    // 早先硬编码 "default" 会在 scope 迁移后对（已清空的）default scope 跑维护、沦为 no-op。
    const report = await runSleepTimeMaintenance(memoryRepository);

    scheduledLogger.info("sleep_time_completed", {
      cron: event.cron,
      durationMs: Date.now() - startedAt,
      driftedEdgesRepaired: report.repair.driftedEdgesRepaired,
      duplicateStatementsArchived: report.repair.duplicateStatementsArchived,
    });
  } catch (error) {
    scheduledLogger.error(
      "sleep_time_failed",
      { cron: event.cron, durationMs: Date.now() - startedAt },
      { error }
    );

    throw error;
  }
};
