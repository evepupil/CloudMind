export interface McpTokenRecord {
  id: string;
  name: string;
  tokenValue: string;
  tokenHash: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface McpTokenSummary {
  id: string;
  name: string;
  tokenValue: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
