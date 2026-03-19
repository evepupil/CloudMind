import { createApp } from "honox/server";

import type { AppEnv } from "@/env";
import { registerAssetRoutes } from "@/features/assets/server/routes";
import { registerChatRoutes } from "@/features/chat/server/routes";
import { registerHealthRoutes } from "@/features/health/server/routes";
import { registerIngestRoutes } from "@/features/ingest/server/routes";
import { registerSearchRoutes } from "@/features/search/server/routes";

// 这里创建单个 HonoX 全栈应用，并挂载所有 API 路由。
const app = createApp<AppEnv>();

registerHealthRoutes(app);
registerAssetRoutes(app);
registerChatRoutes(app);
registerIngestRoutes(app);
registerSearchRoutes(app);

export default app;
