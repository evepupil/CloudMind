import type { JwtVariables } from "hono/jwt";

import type { AuthSessionPayload } from "@/core/auth/types";

// 基础设施绑定由 wrangler types 生成；这里只补充不在配置文件中的可选应用变量。
export interface AppBindings extends Partial<CloudflareBindings> {
  APP_NAME?: string;
  JINA_API_KEY?: string;
  JWT_SECRET?: string;
}

// 这里导出全局环境类型，供 Hono 与 feature 路由复用。
export interface AppEnv {
  Bindings: AppBindings;
  Variables: JwtVariables<AuthSessionPayload> & {
    authSession: AuthSessionPayload;
  };
}
