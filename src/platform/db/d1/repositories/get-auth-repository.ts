import type { AuthRepository } from "@/core/auth/ports";
import type { AppBindings } from "@/env";

import { D1AuthRepository } from "./d1-auth-repository";

const getDatabaseBinding = (bindings: AppBindings | undefined): D1Database => {
  if (!bindings?.DB) {
    throw new Error(
      'Cloudflare D1 binding "DB" is not configured. ' +
        "Create the database and bind it in wrangler.jsonc before using auth."
    );
  }

  return bindings.DB;
};

// 这里收敛 auth 仓储实例化逻辑，避免上层直接依赖 D1 实现。
export const getAuthRepositoryFromBindings = (
  bindings: AppBindings | undefined
): AuthRepository => {
  return new D1AuthRepository(getDatabaseBinding(bindings));
};
