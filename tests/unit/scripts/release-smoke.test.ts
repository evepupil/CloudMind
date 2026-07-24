import { describe, expect, it, vi } from "vitest";

import { runProductionSmoke } from "../../../scripts/release/smoke-core.ts";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("production release smoke", () => {
  it("checks health, login rendering, and MCP authentication", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ ok: true, service: "cloudmind" }))
      .mockResolvedValueOnce(
        new Response("<html>login</html>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401));

    await runProductionSmoke({
      baseUrl: "https://cloudmind.example/",
      fetcher,
      sleep: async () => undefined,
    });

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[2]?.[1]?.method).toBe("POST");
  });

  it("retries health before continuing", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("deployment not propagated"))
      .mockResolvedValueOnce(jsonResponse({ ok: true, service: "cloudmind" }))
      .mockResolvedValueOnce(
        new Response("<html>login</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
      )
      .mockResolvedValueOnce(jsonResponse({}, 401));

    await runProductionSmoke({
      baseUrl: "https://cloudmind.example",
      fetcher,
      attempts: 2,
      sleep: async () => undefined,
    });

    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
