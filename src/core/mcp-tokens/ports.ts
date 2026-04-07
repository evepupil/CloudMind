import type { McpTokenRecord } from "@/features/mcp-tokens/model/types";

export interface CreateMcpTokenInput {
  name: string;
  tokenValue: string;
  tokenHash: string;
}

// 这里抽出 MCP token 仓储接口，避免 feature 逻辑直接绑定 D1。
export interface McpTokenRepository {
  listTokens(): Promise<McpTokenRecord[]>;
  createToken(input: CreateMcpTokenInput): Promise<McpTokenRecord>;
  findActiveTokenByHash(tokenHash: string): Promise<McpTokenRecord | null>;
  markTokenUsed(id: string, usedAt: string): Promise<void>;
  revokeToken(id: string): Promise<McpTokenRecord>;
}
