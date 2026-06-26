import { createApp } from "honox/server";

import type { JobQueueMessage } from "@/core/queue/ports";
import type { AppEnv } from "@/env";
import { registerAssetRoutes } from "@/features/assets/server/routes";
import { authMiddleware } from "@/features/auth/server/middleware";
import { registerAuthRoutes } from "@/features/auth/server/routes";
import { registerChatRoutes } from "@/features/chat/server/routes";
import { registerHealthRoutes } from "@/features/health/server/routes";
import { registerIngestRoutes } from "@/features/ingest/server/routes";
import { registerMcpRoutes } from "@/features/mcp/server/routes";
import { registerMcpTokenRoutes } from "@/features/mcp-tokens/server/routes";
import { registerMemoryRoutes } from "@/features/memory/server/routes";
import { registerSearchRoutes } from "@/features/search/server/routes";
import { consumeWorkflowQueueMessage } from "@/features/workflows/server/queue-consumer";
import { consumeScheduledEvent } from "@/features/workflows/server/scheduled-consumer";

// 这里创建单个 HonoX 全栈应用，并挂载所有 API 路由。
const app = createApp<AppEnv>({
  init: (server) => {
    server.use("*", authMiddleware);
    registerAuthRoutes(server);
    registerHealthRoutes(server);
    registerAssetRoutes(server);
    registerChatRoutes(server);
    registerIngestRoutes(server);
    registerMcpRoutes(server);
    registerMcpTokenRoutes(server);
    registerMemoryRoutes(server);
    registerSearchRoutes(server);
  },
});

export default {
  fetch: app.fetch,
  queue: async (
    batch: MessageBatch<unknown>,
    env: AppEnv["Bindings"]
  ): Promise<void> => {
    for (const message of batch.messages) {
      await consumeWorkflowQueueMessage(message.body as JobQueueMessage, env);
      message.ack();
    }
  },
  // Cron 触发的 sleep-time 维护（知识图谱一致性修复，后续叠加遗忘/整合/社区）。
  scheduled: async (
    controller: ScheduledController,
    env: AppEnv["Bindings"]
  ): Promise<void> => {
    await consumeScheduledEvent(controller, env);
  },
} satisfies ExportedHandler<AppEnv["Bindings"]>;
