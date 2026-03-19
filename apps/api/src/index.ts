import { createApp } from "./app";

// 这里导出 Worker 默认入口，供 Wrangler 直接加载。
const app = createApp();

export default app;
