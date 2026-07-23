import type { AssetIngestRepository } from "@/core/assets/ports";
import { createRawAssetBlobKey } from "@/core/blob/keys";
import type { BlobStore } from "@/core/blob/ports";
import type { AssetDetail } from "@/features/assets/model/types";

type SnapshotAsset = Pick<AssetDetail, "id" | "contentText" | "rawR2Key">;
type SnapshotRepository = Pick<AssetIngestRepository, "attachAssetRawSnapshot">;

export interface TextSourceSnapshot {
  content: string;
  rawR2Key: string;
  source: "archive" | "created" | "recovered";
}

const decodeSnapshot = (body: ArrayBuffer): string => {
  return new TextDecoder().decode(body);
};

export const loadOrCreateTextSourceSnapshot = async (
  asset: SnapshotAsset,
  repository: SnapshotRepository,
  blobStore: BlobStore
): Promise<TextSourceSnapshot> => {
  const attachedKey = asset.rawR2Key?.trim();

  if (attachedKey) {
    const archived = await blobStore.get(attachedKey);

    if (!archived) {
      throw new Error(
        `Asset raw text snapshot "${attachedKey}" was not found in blob storage.`
      );
    }

    return {
      content: decodeSnapshot(archived.body),
      rawR2Key: attachedKey,
      source: "archive",
    };
  }

  if (asset.contentText === null) {
    throw new Error("Asset original text is missing and cannot be archived.");
  }

  const rawR2Key = createRawAssetBlobKey(asset.id, "input.txt");
  const archived = await blobStore.get(rawR2Key);

  if (archived) {
    await repository.attachAssetRawSnapshot(asset.id, rawR2Key);

    return {
      content: decodeSnapshot(archived.body),
      rawR2Key,
      source: "recovered",
    };
  }

  const encoded = new TextEncoder().encode(asset.contentText);
  const body = encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength
  ) as ArrayBuffer;

  await blobStore.put({
    key: rawR2Key,
    body,
    contentType: "text/plain; charset=utf-8",
  });
  await repository.attachAssetRawSnapshot(asset.id, rawR2Key);

  return {
    content: asset.contentText,
    rawR2Key,
    source: "created",
  };
};
