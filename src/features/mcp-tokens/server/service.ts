import type { McpTokenRepository } from "@/core/mcp-tokens/ports";
import type { AppBindings } from "@/env";
import type {
  McpTokenRecord,
  McpTokenSummary,
} from "@/features/mcp-tokens/model/types";
import { getMcpTokenRepositoryFromBindings } from "@/platform/db/d1/repositories/get-mcp-token-repository";

import {
  generateMcpTokenValue,
  hashMcpTokenValue,
  parseBearerToken,
} from "./token-secret";

interface McpTokenServiceDependencies {
  getMcpTokenRepository: (
    bindings: AppBindings | undefined
  ) => McpTokenRepository | Promise<McpTokenRepository>;
}

const defaultDependencies: McpTokenServiceDependencies = {
  getMcpTokenRepository: getMcpTokenRepositoryFromBindings,
};

const toMcpTokenSummary = (item: McpTokenRecord): McpTokenSummary => {
  return {
    id: item.id,
    name: item.name,
    tokenValue: item.tokenValue,
    lastUsedAt: item.lastUsedAt,
    revokedAt: item.revokedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

// 这里集中收敛 MCP token 生命周期，当前只处理最小 bearer token 鉴权。
export const createMcpTokenService = (
  dependencies: McpTokenServiceDependencies = defaultDependencies
) => {
  return {
    async listMcpTokens(
      bindings: AppBindings | undefined
    ): Promise<McpTokenSummary[]> {
      const repository = await dependencies.getMcpTokenRepository(bindings);
      const items = await repository.listTokens();

      return items.map(toMcpTokenSummary);
    },

    async createMcpToken(
      bindings: AppBindings | undefined,
      input: { name: string }
    ): Promise<McpTokenSummary> {
      const repository = await dependencies.getMcpTokenRepository(bindings);
      const tokenValue = generateMcpTokenValue();
      const tokenHash = await hashMcpTokenValue(tokenValue);
      const item = await repository.createToken({
        name: input.name,
        tokenValue,
        tokenHash,
      });

      return toMcpTokenSummary(item);
    },

    async revokeMcpToken(
      bindings: AppBindings | undefined,
      id: string
    ): Promise<McpTokenSummary> {
      const repository = await dependencies.getMcpTokenRepository(bindings);
      const item = await repository.revokeToken(id);

      return toMcpTokenSummary(item);
    },

    async authenticateMcpRequest(
      bindings: AppBindings | undefined,
      authorizationHeader: string | undefined
    ): Promise<McpTokenSummary | null> {
      const tokenValue = parseBearerToken(authorizationHeader);

      if (!tokenValue) {
        return null;
      }

      const repository = await dependencies.getMcpTokenRepository(bindings);
      const tokenHash = await hashMcpTokenValue(tokenValue);
      const item = await repository.findActiveTokenByHash(tokenHash);

      if (!item || item.tokenValue !== tokenValue) {
        return null;
      }

      const usedAt = new Date().toISOString();

      await repository.markTokenUsed(item.id, usedAt);

      return toMcpTokenSummary({
        ...item,
        lastUsedAt: usedAt,
        updatedAt: usedAt,
      });
    },
  };
};

const mcpTokenService = createMcpTokenService();

export const {
  listMcpTokens,
  createMcpToken,
  revokeMcpToken,
  authenticateMcpRequest,
} = mcpTokenService;
