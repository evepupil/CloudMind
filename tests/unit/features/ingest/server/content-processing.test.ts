import { afterEach, describe, expect, it, vi } from "vitest";

import type { AIProvider } from "@/core/ai/ports";
import {
  generateAssetSummary,
  generateAssetTitle,
} from "@/features/ingest/server/content-processing";

const parseLogPayload = (
  call: unknown[] | undefined
): Record<string, unknown> => {
  return JSON.parse((call?.[0] as string | undefined) ?? "{}") as Record<
    string,
    unknown
  >;
};

describe("generateAssetSummary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs provider and model when AI summary generation succeeds", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const aiProvider: AIProvider = {
      generateText: vi.fn(async () => ({
        text: "CloudMind summary",
        provider: "workers_ai",
        model: "@cf/qwen/qwen3-30b-a3b-fp8",
      })),
      createEmbeddings: vi.fn(async () => ({
        embeddings: [],
      })),
    };

    const summary = await generateAssetSummary(aiProvider, {
      title: "CloudMind",
      content: "CloudMind turns saved content into structured knowledge.",
    });

    expect(summary).toBe("CloudMind summary");

    const payload = parseLogPayload(
      logSpy.mock.calls.find((call) => {
        return String(call[0]).includes(
          '"event":"summary_generation_succeeded"'
        );
      })
    );

    expect(payload.scope).toBe("ingest_ai");
    expect(payload.event).toBe("summary_generation_succeeded");
    expect(payload.aiProvider).toBe("workers_ai");
    expect(payload.aiModel).toBe("@cf/qwen/qwen3-30b-a3b-fp8");
  });

  it("logs provider and failure details when AI summary generation fails", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const aiProvider: AIProvider = {
      generateText: vi.fn(async () => {
        throw new Error("Workers AI timeout");
      }),
      createEmbeddings: vi.fn(async () => ({
        embeddings: [],
      })),
    };

    await expect(
      generateAssetSummary(aiProvider, {
        title: "CloudMind",
        content: "CloudMind turns saved content into structured knowledge.",
      })
    ).rejects.toThrow("Workers AI timeout");

    const payload = parseLogPayload(
      errorSpy.mock.calls.find((call) => {
        return String(call[0]).includes('"event":"summary_generation_failed"');
      })
    );

    expect(payload.scope).toBe("ingest_ai");
    expect(payload.event).toBe("summary_generation_failed");
    expect(payload.aiProvider).toBe("unknown");
    expect(payload.aiModel).toBeNull();
    expect(payload.errorMessage).toBe("Workers AI timeout");
  });
});

describe("generateAssetTitle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs provider and model when AI title generation succeeds", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const aiProvider: AIProvider = {
      generateText: vi.fn(async () => ({
        text: "CloudMind 架构路线图",
        provider: "workers_ai",
        model: "@cf/qwen/qwen3-30b-a3b-fp8",
      })),
      createEmbeddings: vi.fn(async () => ({
        embeddings: [],
      })),
    };

    const title = await generateAssetTitle(aiProvider, {
      currentTitle: "Untitled Note",
      summary: "CloudMind 本轮重点是打通 ingest、检索和 evidence delivery。",
      content: "CloudMind 本轮重点是打通 ingest、检索和 evidence delivery。",
    });

    expect(title).toBe("CloudMind 架构路线图");

    const payload = parseLogPayload(
      logSpy.mock.calls.find((call) => {
        return String(call[0]).includes('"event":"title_generation_succeeded"');
      })
    );

    expect(payload.scope).toBe("ingest_ai");
    expect(payload.event).toBe("title_generation_succeeded");
    expect(payload.aiProvider).toBe("workers_ai");
    expect(payload.aiModel).toBe("@cf/qwen/qwen3-30b-a3b-fp8");
  });

  it("logs provider and failure details when AI title generation fails", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const aiProvider: AIProvider = {
      generateText: vi.fn(async () => {
        throw new Error("Workers AI title timeout");
      }),
      createEmbeddings: vi.fn(async () => ({
        embeddings: [],
      })),
    };

    await expect(
      generateAssetTitle(aiProvider, {
        currentTitle: "Untitled Note",
        summary: "CloudMind 本轮重点是打通 ingest、检索和 evidence delivery。",
        content: "CloudMind 本轮重点是打通 ingest、检索和 evidence delivery。",
      })
    ).rejects.toThrow("Workers AI title timeout");

    const payload = parseLogPayload(
      errorSpy.mock.calls.find((call) => {
        return String(call[0]).includes('"event":"title_generation_failed"');
      })
    );

    expect(payload.scope).toBe("ingest_ai");
    expect(payload.event).toBe("title_generation_failed");
    expect(payload.aiProvider).toBe("unknown");
    expect(payload.aiModel).toBeNull();
    expect(payload.errorMessage).toBe("Workers AI title timeout");
  });

  it("accepts a generated title even when it matches the summary", async () => {
    const aiProvider: AIProvider = {
      generateText: vi.fn(async () => ({
        text: "CloudMind 入库链路改造",
        provider: "workers_ai",
        model: "@cf/qwen/qwen3-30b-a3b-fp8",
      })),
      createEmbeddings: vi.fn(async () => ({
        embeddings: [],
      })),
    };

    const title = await generateAssetTitle(aiProvider, {
      currentTitle: "Untitled Note",
      summary: "CloudMind 入库链路改造",
      content: "CloudMind 本轮重点是打通 ingest、检索和 evidence delivery。",
    });

    expect(title).toBe("CloudMind 入库链路改造");
  });
});
