// 这里集中定义 Cloudflare Pages Functions 可用的绑定类型。
export interface AppBindings {
  APP_NAME?: string;
  DB?: D1Database;
}

// 这里导出全局环境类型，供 Hono 与 feature 路由复用。
export interface AppEnv {
  Bindings: AppBindings;
}
