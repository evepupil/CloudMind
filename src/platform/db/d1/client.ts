import { drizzle } from "drizzle-orm/d1";

import * as schema from "@/platform/db/d1/schema";

// 这里收敛 D1 -> Drizzle 的初始化逻辑，避免业务代码直接依赖具体驱动。
export const createDb = (database: D1Database) => {
  return drizzle(database, {
    schema,
  });
};
