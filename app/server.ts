import { createApp } from "honox/server";

import type { JobQueueMessage } from "@/core/queue/ports";
import type { AppEnv } from "@/env";
import { registerAssetRoutes } from "@/features/assets/server/routes";
import { registerChatRoutes } from "@/features/chat/server/routes";
import { registerHealthRoutes } from "@/features/health/server/routes";
import { registerIngestRoutes } from "@/features/ingest/server/routes";
import { registerMcpRoutes } from "@/features/mcp/server/routes";
import { registerSearchRoutes } from "@/features/search/server/routes";
import { consumeWorkflowQueueMessage } from "@/features/workflows/server/queue-consumer";

// 这里创建单个 HonoX 全栈应用，并挂载所有 API 路由。
const app = createApp<AppEnv>();

registerHealthRoutes(app);
registerAssetRoutes(app);
registerChatRoutes(app);
registerIngestRoutes(app);
registerMcpRoutes(app);
registerSearchRoutes(app);

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
} satisfies ExportedHandler<AppEnv["Bindings"]>;
