import { describe, expect, it, vi } from "vitest";

import type { BlobObject, BlobStore } from "@/core/blob/ports";
import { loadOrCreateTextSourceSnapshot } from "@/features/workflows/server/text-source-snapshot";

const encode = (value: string): ArrayBuffer => {
  const encoded = new TextEncoder().encode(value);

  return encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength
  ) as ArrayBuffer;
};

const createBlobObject = (key: string, content: string): BlobObject => ({
  key,
  body: encode(content),
  size: encode(content).byteLength,
  contentType: "text/plain; charset=utf-8",
});

const createBlobStore = (
  get: BlobStore["get"],
  put: BlobStore["put"] = vi.fn()
): BlobStore => ({ get, put });

describe("loadOrCreateTextSourceSnapshot", () => {
  it("stores the exact original text before attaching the snapshot", async () => {
    const put = vi.fn<BlobStore["put"]>();
    const attachAssetRawSnapshot = vi.fn(async () => {});
    const original = "  first line\r\nsecond line  ";

    const result = await loadOrCreateTextSourceSnapshot(
      {
        id: "asset-1",
        contentText: original,
        rawR2Key: null,
      },
      { attachAssetRawSnapshot },
      createBlobStore(
        vi.fn(async () => null),
        put
      )
    );

    expect(result).toEqual({
      content: original,
      rawR2Key: "assets/asset-1/raw/input.txt",
      source: "created",
    });
    expect(put).toHaveBeenCalledOnce();
    const putInput = put.mock.calls[0]?.[0];
    expect(putInput?.key).toBe("assets/asset-1/raw/input.txt");
    expect(new TextDecoder().decode(putInput?.body)).toBe(original);
    expect(attachAssetRawSnapshot).toHaveBeenCalledWith(
      "asset-1",
      "assets/asset-1/raw/input.txt"
    );
    expect(put.mock.invocationCallOrder[0]).toBeLessThan(
      attachAssetRawSnapshot.mock.invocationCallOrder[0] ?? 0
    );
  });

  it("reuses an attached snapshot and ignores mutable asset text", async () => {
    const rawR2Key = "assets/asset-1/raw/input.txt";
    const put = vi.fn<BlobStore["put"]>();
    const attachAssetRawSnapshot = vi.fn(async () => {});

    const result = await loadOrCreateTextSourceSnapshot(
      {
        id: "asset-1",
        contentText: "mutated preview",
        rawR2Key,
      },
      { attachAssetRawSnapshot },
      createBlobStore(
        vi.fn(async () => createBlobObject(rawR2Key, "archived original")),
        put
      )
    );

    expect(result.content).toBe("archived original");
    expect(result.source).toBe("archive");
    expect(put).not.toHaveBeenCalled();
    expect(attachAssetRawSnapshot).not.toHaveBeenCalled();
  });

  it("recovers an R2 object written before its D1 pointer", async () => {
    const rawR2Key = "assets/asset-1/raw/input.txt";
    const put = vi.fn<BlobStore["put"]>();
    const attachAssetRawSnapshot = vi.fn(async () => {});

    const result = await loadOrCreateTextSourceSnapshot(
      {
        id: "asset-1",
        contentText: "mutable D1 copy",
        rawR2Key: null,
      },
      { attachAssetRawSnapshot },
      createBlobStore(
        vi.fn(async () => createBlobObject(rawR2Key, "already archived")),
        put
      )
    );

    expect(result.content).toBe("already archived");
    expect(result.source).toBe("recovered");
    expect(put).not.toHaveBeenCalled();
    expect(attachAssetRawSnapshot).toHaveBeenCalledWith("asset-1", rawR2Key);
  });

  it("does not recreate a missing snapshot from mutable asset text", async () => {
    const put = vi.fn<BlobStore["put"]>();

    await expect(
      loadOrCreateTextSourceSnapshot(
        {
          id: "asset-1",
          contentText: "mutable D1 copy",
          rawR2Key: "assets/asset-1/raw/input.txt",
        },
        { attachAssetRawSnapshot: vi.fn(async () => {}) },
        createBlobStore(
          vi.fn(async () => null),
          put
        )
      )
    ).rejects.toThrow("was not found in blob storage");

    expect(put).not.toHaveBeenCalled();
  });

  it("does not attach a pointer when the R2 write fails", async () => {
    const attachAssetRawSnapshot = vi.fn(async () => {});

    await expect(
      loadOrCreateTextSourceSnapshot(
        {
          id: "asset-1",
          contentText: "durable input",
          rawR2Key: null,
        },
        { attachAssetRawSnapshot },
        createBlobStore(
          vi.fn(async () => null),
          vi.fn(async () => {
            throw new Error("R2 unavailable");
          })
        )
      )
    ).rejects.toThrow("R2 unavailable");

    expect(attachAssetRawSnapshot).not.toHaveBeenCalled();
  });
});
