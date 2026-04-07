import type { AuthAccountRecord } from "@/core/auth/types";

export interface CreateAuthAccountInput {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  mustChangePassword: boolean;
}

export interface UpdateAuthPasswordInput {
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  mustChangePassword: boolean;
}

// 这里定义单用户认证仓储接口，避免业务层直接依赖 D1 细节。
export interface AuthRepository {
  getPrimaryAccount(): Promise<AuthAccountRecord | null>;
  createPrimaryAccount(
    input: CreateAuthAccountInput
  ): Promise<AuthAccountRecord>;
  markLogin(id: string, loggedInAt: string): Promise<void>;
  updatePassword(
    id: string,
    input: UpdateAuthPasswordInput
  ): Promise<AuthAccountRecord>;
}
