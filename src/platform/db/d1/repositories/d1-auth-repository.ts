import { eq } from "drizzle-orm";

import type {
  AuthRepository,
  CreateAuthAccountInput,
  UpdateAuthPasswordInput,
} from "@/core/auth/ports";
import type { AuthAccountRecord } from "@/core/auth/types";
import { createDb } from "@/platform/db/d1/client";
import { authAccounts } from "@/platform/db/d1/schema";

const mapAuthAccountRecord = (
  record: typeof authAccounts.$inferSelect
): AuthAccountRecord => {
  return {
    id: record.id,
    username: record.username,
    passwordHash: record.passwordHash,
    passwordSalt: record.passwordSalt,
    passwordIterations: record.passwordIterations,
    mustChangePassword: record.mustChangePassword,
    lastLoginAt: record.lastLoginAt,
    passwordUpdatedAt: record.passwordUpdatedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

// 这里实现单用户认证仓储，先只维护一个主账号。
export class D1AuthRepository implements AuthRepository {
  private readonly db: ReturnType<typeof createDb>;

  public constructor(database: D1Database) {
    this.db = createDb(database);
  }

  public async getPrimaryAccount(): Promise<AuthAccountRecord | null> {
    const [record] = await this.db.select().from(authAccounts).limit(1);

    return record ? mapAuthAccountRecord(record) : null;
  }

  public async createPrimaryAccount(
    input: CreateAuthAccountInput
  ): Promise<AuthAccountRecord> {
    const now = new Date().toISOString();

    await this.db.insert(authAccounts).values({
      id: input.id,
      username: input.username,
      passwordHash: input.passwordHash,
      passwordSalt: input.passwordSalt,
      passwordIterations: input.passwordIterations,
      mustChangePassword: input.mustChangePassword,
      lastLoginAt: null,
      passwordUpdatedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: input.id,
      username: input.username,
      passwordHash: input.passwordHash,
      passwordSalt: input.passwordSalt,
      passwordIterations: input.passwordIterations,
      mustChangePassword: input.mustChangePassword,
      lastLoginAt: null,
      passwordUpdatedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  public async markLogin(id: string, loggedInAt: string): Promise<void> {
    await this.db
      .update(authAccounts)
      .set({
        lastLoginAt: loggedInAt,
        updatedAt: loggedInAt,
      })
      .where(eq(authAccounts.id, id));
  }

  public async updatePassword(
    id: string,
    input: UpdateAuthPasswordInput
  ): Promise<AuthAccountRecord> {
    const [record] = await this.db
      .select()
      .from(authAccounts)
      .where(eq(authAccounts.id, id))
      .limit(1);

    if (!record) {
      throw new Error("Primary auth account not found.");
    }

    const now = new Date().toISOString();

    await this.db
      .update(authAccounts)
      .set({
        passwordHash: input.passwordHash,
        passwordSalt: input.passwordSalt,
        passwordIterations: input.passwordIterations,
        mustChangePassword: input.mustChangePassword,
        passwordUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(authAccounts.id, id));

    return mapAuthAccountRecord({
      ...record,
      passwordHash: input.passwordHash,
      passwordSalt: input.passwordSalt,
      passwordIterations: input.passwordIterations,
      mustChangePassword: input.mustChangePassword,
      passwordUpdatedAt: now,
      updatedAt: now,
    });
  }
}
