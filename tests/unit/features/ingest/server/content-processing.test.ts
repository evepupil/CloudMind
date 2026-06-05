import { afterEach, describe, expect, it, vi } from "vitest";

import type { AIProvider } from "@/core/ai/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { AssetDetail } from "@/features/assets/model/types";
import {
  type ChunkEmbeddingPlanItem,
  computeChunkContentHash,
  generateAssetSummary,
  generateAssetTitle,
  indexPlannedChunks,
  type PreparedChunk,
  planChunkEmbeddings,
} from "@/features/ingest/server/content-processing";

const EMBEDDING_MODEL = "@cf/baai/bge-m3";

const makeChunk = (chunkIndex: number, text: string): PreparedChunk => ({
  chunkIndex,
  text,
  textPreview: text.slice(0, 20),
  contentHash: computeChunkContentHash(text),
});

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

describe("computeChunkContentHash", () => {
  it("is stable across runs for the same text", () => {
    expect(computeChunkContentHash("hello world")).toBe(
      computeChunkContentHash("hello world")
    );
  });

  it("differs for different text and is 64-char hex", () => {
    const hash = computeChunkContentHash("alpha");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(computeChunkContentHash("beta"));
  });
});

describe("planChunkEmbeddings", () => {
  it("marks every chunk for embedding when there are no existing chunks", () => {
    const plan = planChunkEmbeddings(
      [makeChunk(0, "alpha"), makeChunk(1, "beta")],
      [],
      EMBEDDING_MODEL
    );

    expect(plan.every((item) => item.reusedVectorId === null)).toBe(true);
  });

  it("reuses vectors for unchanged chunks (same hash + model)", () => {
    const chunks = [makeChunk(0, "alpha"), makeChunk(1, "beta")];
    const existing = chunks.map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      contentHash: chunk.contentHash,
      embeddingModel: EMBEDDING_MODEL,
      vectorId: `asset:${chunk.chunkIndex}`,
    }));

    const plan = planChunkEmbeddings(chunks, existing, EMBEDDING_MODEL);

    expect(plan.map((item) => item.reusedVectorId)).toEqual([
      "asset:0",
      "asset:1",
    ]);
  });

  it("re-embeds a chunk whose content changed", () => {
    const plan = planChunkEmbeddings(
      [makeChunk(0, "new content")],
      [
        {
          chunkIndex: 0,
          contentHash: computeChunkContentHash("old content"),
          embeddingModel: EMBEDDING_MODEL,
          vectorId: "asset:0",
        },
      ],
      EMBEDDING_MODEL
    );

    expect(plan[0]?.reusedVectorId).toBeNull();
  });

  it("re-embeds when the embedding model changed", () => {
    const chunk = makeChunk(0, "alpha");
    const plan = planChunkEmbeddings(
      [chunk],
      [
        {
          chunkIndex: 0,
          contentHash: chunk.contentHash,
          embeddingModel: "old-model",
          vectorId: "asset:0",
        },
      ],
      EMBEDDING_MODEL
    );

    expect(plan[0]?.reusedVectorId).toBeNull();
  });

  it("never reuses when the current model is unknown", () => {
    const chunk = makeChunk(0, "alpha");
    const plan = planChunkEmbeddings(
      [chunk],
      [
        {
          chunkIndex: 0,
          contentHash: chunk.contentHash,
          embeddingModel: undefined,
          vectorId: "asset:0",
        },
      ],
      undefined
    );

    expect(plan[0]?.reusedVectorId).toBeNull();
  });
});

describe("indexPlannedChunks", () => {
  const makeAsset = (chunks: AssetDetail["chunks"]): AssetDetail =>
    ({ id: "asset", chunks }) as unknown as AssetDetail;

  it("only upserts changed chunks, reuses unchanged ones, and stamps model/dim/hash", async () => {
    const upsert = vi.fn(async (_records: unknown) => undefined);
    const deleteByIds = vi.fn(async (_ids: string[]) => undefined);
    const store: VectorStore = {
      upsert,
      search: vi.fn(async () => []),
      deleteByIds,
    };

    const plan: ChunkEmbeddingPlanItem[] = [
      {
        chunkIndex: 0,
        text: "unchanged",
        textPreview: "unchanged",
        contentHash: "h0",
        reusedVectorId: "asset:0",
      },
      {
        chunkIndex: 1,
        text: "changed",
        textPreview: "changed",
        contentHash: "h1new",
        reusedVectorId: null,
      },
    ];
    const asset = makeAsset([
      {
        id: "c0",
        chunkIndex: 0,
        textPreview: "u",
        vectorId: "asset:0",
        contentHash: "h0",
        embeddingModel: EMBEDDING_MODEL,
        embeddingDim: 4,
      },
      {
        id: "c1",
        chunkIndex: 1,
        textPreview: "c",
        vectorId: "asset:1",
        contentHash: "h1old",
        embeddingModel: EMBEDDING_MODEL,
        embeddingDim: 4,
      },
    ]);

    const result = await indexPlannedChunks(
      store,
      asset,
      plan,
      [[0.1, 0.2, 0.3, 0.4]],
      EMBEDDING_MODEL
    );

    // 只对变化的 chunk（index 1）upsert 一个向量
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith([
      expect.objectContaining({ id: "asset:1" }),
    ]);
    // 全部 chunk 都带上 model / dim / hash
    expect(result).toHaveLength(2);
    expect(
      result.every((chunk) => chunk.embeddingModel === EMBEDDING_MODEL)
    ).toBe(true);
    expect(result[0]?.contentHash).toBe("h0");
    expect(result[1]?.contentHash).toBe("h1new");
    expect(result[0]?.embeddingDim).toBe(4);
    expect(result[1]?.embeddingDim).toBe(4);
  });

  it("deletes all existing vectors when there are no chunks", async () => {
    const deleteByIds = vi.fn(async (_ids: string[]) => undefined);
    const store: VectorStore = {
      upsert: vi.fn(async (_records: unknown) => undefined),
      search: vi.fn(async () => []),
      deleteByIds,
    };
    const asset = makeAsset([
      { id: "c0", chunkIndex: 0, textPreview: "x", vectorId: "asset:0" },
    ]);

    const result = await indexPlannedChunks(
      store,
      asset,
      [],
      [],
      EMBEDDING_MODEL
    );

    expect(result).toEqual([]);
    expect(deleteByIds).toHaveBeenCalledWith(["asset:0"]);
  });
});
