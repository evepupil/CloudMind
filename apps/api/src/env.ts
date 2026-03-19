// 这里集中定义 Worker 绑定类型，后续接入 D1、R2、AI 时只改这一处。
export interface AppBindings {
  APP_NAME?: string;
}

// 这里导出 Hono 使用的环境类型，避免各个模块重复声明。
export interface AppEnv {
  Bindings: AppBindings;
}
