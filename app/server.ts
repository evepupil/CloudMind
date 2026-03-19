import { createApp } from "honox/server";

import type { AppEnv } from "@/env";
import { registerAssetRoutes } from "@/features/assets/server/routes";
import { registerHealthRoutes } from "@/features/health/server/routes";

// 这里创建单个 HonoX 全栈应用，并挂载所有 API 路由。
const app = createApp<AppEnv>();

registerHealthRoutes(app);
registerAssetRoutes(app);

export default app;
