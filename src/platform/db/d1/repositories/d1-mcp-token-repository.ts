import { and, desc, eq, isNull } from "drizzle-orm";

import { McpTokenNotFoundError } from "@/core/mcp-tokens/errors";
import type {
  CreateMcpTokenInput,
  McpTokenRepository,
} from "@/core/mcp-tokens/ports";
import type { McpTokenRecord } from "@/features/mcp-tokens/model/types";
import { createDb } from "@/platform/db/d1/client";
import { mcpTokens } from "@/platform/db/d1/schema";

const mapMcpTokenRecord = (
  record: typeof mcpTokens.$inferSelect
): McpTokenRecord => {
  return {
    id: record.id,
    name: record.name,
    tokenValue: record.tokenValue,
    tokenHash: record.tokenHash,
    lastUsedAt: record.lastUsedAt,
    revokedAt: record.revokedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

// 这里实现 MCP token 的 D1 仓储，供管理页和鉴权入口共用。
export class D1McpTokenRepository implements McpTokenRepository {
  private readonly db: ReturnType<typeof createDb>;

  public constructor(database: D1Database) {
    this.db = createDb(database);
  }

  public async listTokens(): Promise<McpTokenRecord[]> {
    const records = await this.db
      .select()
      .from(mcpTokens)
      .orderBy(desc(mcpTokens.createdAt));

    return records.map(mapMcpTokenRecord);
  }

  public async createToken(
    input: CreateMcpTokenInput
  ): Promise<McpTokenRecord> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await this.db.insert(mcpTokens).values({
      id,
      name: input.name,
      tokenValue: input.tokenValue,
      tokenHash: input.tokenHash,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      name: input.name,
      tokenValue: input.tokenValue,
      tokenHash: input.tokenHash,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  public async findActiveTokenByHash(
    tokenHash: string
  ): Promise<McpTokenRecord | null> {
    const [record] = await this.db
      .select()
      .from(mcpTokens)
      .where(
        and(eq(mcpTokens.tokenHash, tokenHash), isNull(mcpTokens.revokedAt))
      )
      .limit(1);

    return record ? mapMcpTokenRecord(record) : null;
  }

  public async markTokenUsed(id: string, usedAt: string): Promise<void> {
    await this.db
      .update(mcpTokens)
      .set({
        lastUsedAt: usedAt,
        updatedAt: usedAt,
      })
      .where(eq(mcpTokens.id, id));
  }

  public async revokeToken(id: string): Promise<McpTokenRecord> {
    const [record] = await this.db
      .select()
      .from(mcpTokens)
      .where(eq(mcpTokens.id, id))
      .limit(1);

    if (!record) {
      throw new McpTokenNotFoundError(id);
    }

    if (record.revokedAt) {
      return mapMcpTokenRecord(record);
    }

    const revokedAt = new Date().toISOString();

    await this.db
      .update(mcpTokens)
      .set({
        revokedAt,
        updatedAt: revokedAt,
      })
      .where(eq(mcpTokens.id, id));

    return mapMcpTokenRecord({
      ...record,
      revokedAt,
      updatedAt: revokedAt,
    });
  }
}
