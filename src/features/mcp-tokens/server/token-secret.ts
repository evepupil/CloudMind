const MCP_TOKEN_PREFIX = "cm_";
const MCP_TOKEN_RANDOM_BYTE_LENGTH = 32;

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

export const generateMcpTokenValue = (): string => {
  const randomBytes = crypto.getRandomValues(
    new Uint8Array(MCP_TOKEN_RANDOM_BYTE_LENGTH)
  );

  return `${MCP_TOKEN_PREFIX}${bytesToHex(randomBytes)}`;
};

export const hashMcpTokenValue = async (
  tokenValue: string
): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(tokenValue)
  );

  return bytesToHex(new Uint8Array(digest));
};

export const parseBearerToken = (
  authorizationHeader: string | undefined
): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const segments = authorizationHeader.trim().split(/\s+/);

  if (segments.length !== 2) {
    return null;
  }

  const [scheme, tokenValue] = segments;

  if (!scheme || !tokenValue || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return tokenValue;
};
