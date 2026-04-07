export interface AuthAccountRecord {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  passwordUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionPayload extends Record<string, unknown> {
  sub: string;
  username: string;
  mustChangePassword: boolean;
  iat: number;
  exp: number;
}
