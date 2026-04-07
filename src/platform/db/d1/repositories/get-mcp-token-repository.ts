import type { McpTokenRepository } from "@/core/mcp-tokens/ports";
import type { AppBindings } from "@/env";

import { D1McpTokenRepository } from "./d1-mcp-token-repository";

const getDatabaseBinding = (bindings: AppBindings | undefined): D1Database => {
  if (!bindings?.DB) {
    throw new Error(
      'Cloudflare D1 binding "DB" is not configured. ' +
        "Create the database and bind it in wrangler.jsonc before using MCP tokens."
    );
  }

  return bindings.DB;
};

// 这里集中解析 MCP token 相关的 D1 仓储实现。
export const getMcpTokenRepositoryFromBindings = (
  bindings: AppBindings | undefined
): McpTokenRepository => {
  return new D1McpTokenRepository(getDatabaseBinding(bindings));
};
