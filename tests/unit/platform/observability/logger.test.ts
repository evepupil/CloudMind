import { afterEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "@/platform/observability/logger";

describe("structured logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits info logs with a stable JSON payload", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createLogger("search");

    logger.info("search_completed", {
      durationMs: 42,
      resultCount: 3,
      resultScope: "preferred_only",
    });

    expect(logSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as Record<
      string,
      unknown
    >;

    expect(payload.app).toBe("cloudmind");
    expect(payload.level).toBe("info");
    expect(payload.scope).toBe("search");
    expect(payload.event).toBe("search_completed");
    expect(payload.durationMs).toBe(42);
    expect(payload.resultCount).toBe(3);
    expect(payload.resultScope).toBe("preferred_only");
    expect(typeof payload.timestamp).toBe("string");
  });

  it("serializes error logs with normalized error fields", () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const logger = createLogger("workflow");

    logger.error(
      "step_failed",
      {
        runId: "run-1",
        stepKey: "embed",
      },
      {
        error: new Error("Embedding timeout"),
      }
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(errorSpy.mock.calls[0]?.[0] as string) as Record<
      string,
      unknown
    >;

    expect(payload.level).toBe("error");
    expect(payload.scope).toBe("workflow");
    expect(payload.event).toBe("step_failed");
    expect(payload.runId).toBe("run-1");
    expect(payload.stepKey).toBe("embed");
    expect(payload.errorName).toBe("Error");
    expect(payload.errorMessage).toBe("Embedding timeout");
    expect(typeof payload.errorStack).toBe("string");
  });
});
