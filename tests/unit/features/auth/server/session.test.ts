import { describe, expect, it } from "vitest";

import { getJwtSecret } from "@/features/auth/server/session";

describe("getJwtSecret", () => {
  it("rejects a missing or blank JWT secret", () => {
    expect(() => getJwtSecret(undefined)).toThrow("JWT_SECRET is required");
    expect(() => getJwtSecret({ JWT_SECRET: "   " })).toThrow(
      "JWT_SECRET is required"
    );
  });

  it("trims the configured JWT secret", () => {
    expect(getJwtSecret({ JWT_SECRET: "  test-secret  " })).toBe("test-secret");
  });
});
