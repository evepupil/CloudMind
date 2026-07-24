import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { AppEnv } from "@/env";
import { authMiddleware } from "@/features/auth/server/middleware";

const createApp = () => {
  const app = new Hono<AppEnv>();
  app.use("*", authMiddleware);
  app.get("/api/health", (context) => context.json({ ok: true }));
  app.get("/api/private", (context) => context.json({ ok: true }));

  return app;
};

describe("authMiddleware", () => {
  it("allows the health check without a JWT secret or session", async () => {
    const response = await createApp().request("/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("keeps other API routes protected", async () => {
    const response = await createApp().request(
      "/api/private",
      {},
      { JWT_SECRET: "test-jwt-secret" }
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication is required.",
      },
    });
  });
});
