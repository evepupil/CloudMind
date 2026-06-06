import type { MemoryRepository } from "@/core/memory/ports";
import type { AppBindings } from "@/env";

import { D1MemoryRepository } from "./d1-memory-repository";

const getDatabaseBinding = (bindings: AppBindings | undefined): D1Database => {
  if (!bindings?.DB) {
    throw new Error(
      'Cloudflare D1 binding "DB" is not configured. ' +
        "Create the database and bind it in wrangler.jsonc before using memory."
    );
  }

  return bindings.DB;
};

// 这里集中解析 D1 绑定，避免业务层直接 new 具体的 L2 记忆仓储实现。
export const getMemoryRepositoryFromBindings = (
  bindings: AppBindings | undefined
): MemoryRepository => {
  return new D1MemoryRepository(getDatabaseBinding(bindings));
};
