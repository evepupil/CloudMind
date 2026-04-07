const PASSWORD_HASH_ALGORITHM = "PBKDF2";
const PASSWORD_HASH_DIGEST = "SHA-256";
const PASSWORD_HASH_DERIVED_BITS = 256;
const PASSWORD_HASH_ITERATIONS = 210000;
const PASSWORD_SALT_BYTES = 16;

const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const hexToBytes = (value: string): Uint8Array => {
  const normalized = value.trim();

  if (normalized.length % 2 !== 0) {
    throw new Error("Invalid hex string length.");
  }

  const bytes = new Uint8Array(normalized.length / 2);

  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = Number.parseInt(normalized.slice(index, index + 2), 16);
  }

  return bytes;
};

const derivePasswordHash = async (
  password: string,
  saltHex: string,
  iterations: number
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    PASSWORD_HASH_ALGORITHM,
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: PASSWORD_HASH_ALGORITHM,
      hash: PASSWORD_HASH_DIGEST,
      salt: hexToBytes(saltHex),
      iterations,
    },
    key,
    PASSWORD_HASH_DERIVED_BITS
  );

  return bytesToHex(new Uint8Array(derivedBits));
};

export const createPasswordHash = async (
  password: string
): Promise<{
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
}> => {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const passwordSalt = bytesToHex(salt);
  const passwordHash = await derivePasswordHash(
    password,
    passwordSalt,
    PASSWORD_HASH_ITERATIONS
  );

  return {
    passwordHash,
    passwordSalt,
    passwordIterations: PASSWORD_HASH_ITERATIONS,
  };
};

export const verifyPasswordHash = async (
  password: string,
  input: {
    passwordHash: string;
    passwordSalt: string;
    passwordIterations: number;
  }
): Promise<boolean> => {
  const derivedHash = await derivePasswordHash(
    password,
    input.passwordSalt,
    input.passwordIterations
  );

  return derivedHash === input.passwordHash;
};
