import { createLogger } from "@/core/logging/logger";
import type { AppBindings } from "@/env";
import { runSleepTimeMaintenance } from "@/features/memory/server/sleep-time";
import { getMemoryRepositoryFromBindings } from "@/platform/db/d1/repositories/get-memory-repository";

const scheduledLogger = createLogger("scheduled");

// Cron 调度入口：装配 D1 记忆仓储并跑 sleep-time 维护（当前为知识图谱一致性修复）。
// 仅 D1 操作、幂等、不依赖 AI/Vectorize；MVP 仅 default scope。失败抛出交平台重试。
export const consumeScheduledEvent = async (
  event: ScheduledController,
  bindings: AppBindings | undefined
): Promise<void> => {
  const startedAt = Date.now();
  const memoryRepository = getMemoryRepositoryFromBindings(bindings);

  try {
    const report = await runSleepTimeMaintenance(memoryRepository, "default");

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
