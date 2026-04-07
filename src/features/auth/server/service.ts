import type { AuthRepository } from "@/core/auth/ports";
import type { AuthAccountRecord } from "@/core/auth/types";
import type { AppBindings } from "@/env";
import { getAuthRepositoryFromBindings } from "@/platform/db/d1/repositories/get-auth-repository";

import { createPasswordHash, verifyPasswordHash } from "./password-hash";

const PRIMARY_AUTH_ACCOUNT_ID = "primary-admin";
const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "admin";

interface AuthServiceDependencies {
  getAuthRepository: (
    bindings: AppBindings | undefined
  ) => AuthRepository | Promise<AuthRepository>;
}

const defaultDependencies: AuthServiceDependencies = {
  getAuthRepository: getAuthRepositoryFromBindings,
};

// 这里集中管理单用户认证逻辑，保证默认账号、改密和登录校验都走同一入口。
export const createAuthService = (
  dependencies: AuthServiceDependencies = defaultDependencies
) => {
  const ensurePrimaryAccount = async (
    bindings: AppBindings | undefined
  ): Promise<AuthAccountRecord> => {
    const repository = await dependencies.getAuthRepository(bindings);
    const existingAccount = await repository.getPrimaryAccount();

    if (existingAccount) {
      return existingAccount;
    }

    const password = await createPasswordHash(DEFAULT_PASSWORD);

    return repository.createPrimaryAccount({
      id: PRIMARY_AUTH_ACCOUNT_ID,
      username: DEFAULT_USERNAME,
      passwordHash: password.passwordHash,
      passwordSalt: password.passwordSalt,
      passwordIterations: password.passwordIterations,
      mustChangePassword: true,
    });
  };

  return {
    ensurePrimaryAccount,

    async authenticateWithPassword(
      bindings: AppBindings | undefined,
      input: {
        username: string;
        password: string;
      }
    ): Promise<
      | {
          ok: true;
          account: AuthAccountRecord;
        }
      | {
          ok: false;
          message: string;
        }
    > {
      const repository = await dependencies.getAuthRepository(bindings);
      const account = await ensurePrimaryAccount(bindings);

      if (input.username !== account.username) {
        return {
          ok: false,
          message: "Invalid username or password.",
        };
      }

      const isValid = await verifyPasswordHash(input.password, {
        passwordHash: account.passwordHash,
        passwordSalt: account.passwordSalt,
        passwordIterations: account.passwordIterations,
      });

      if (!isValid) {
        return {
          ok: false,
          message: "Invalid username or password.",
        };
      }

      const loggedInAt = new Date().toISOString();

      await repository.markLogin(account.id, loggedInAt);

      return {
        ok: true,
        account: {
          ...account,
          lastLoginAt: loggedInAt,
          updatedAt: loggedInAt,
        },
      };
    },

    async changePassword(
      bindings: AppBindings | undefined,
      input: {
        accountId: string;
        currentPassword: string;
        newPassword: string;
      }
    ): Promise<
      | {
          ok: true;
          account: AuthAccountRecord;
        }
      | {
          ok: false;
          message: string;
        }
    > {
      const repository = await dependencies.getAuthRepository(bindings);
      const account = await ensurePrimaryAccount(bindings);

      if (input.accountId !== account.id) {
        return {
          ok: false,
          message: "Invalid auth session.",
        };
      }

      const isCurrentPasswordValid = await verifyPasswordHash(
        input.currentPassword,
        {
          passwordHash: account.passwordHash,
          passwordSalt: account.passwordSalt,
          passwordIterations: account.passwordIterations,
        }
      );

      if (!isCurrentPasswordValid) {
        return {
          ok: false,
          message: "Current password is incorrect.",
        };
      }

      if (input.currentPassword === input.newPassword) {
        return {
          ok: false,
          message: "New password must be different from the current password.",
        };
      }

      const password = await createPasswordHash(input.newPassword);
      const updatedAccount = await repository.updatePassword(account.id, {
        passwordHash: password.passwordHash,
        passwordSalt: password.passwordSalt,
        passwordIterations: password.passwordIterations,
        mustChangePassword: false,
      });

      return {
        ok: true,
        account: updatedAccount,
      };
    },
  };
};

const authService = createAuthService();

export const {
  ensurePrimaryAccount,
  authenticateWithPassword,
  changePassword,
} = authService;
