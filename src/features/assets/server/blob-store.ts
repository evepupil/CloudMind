export interface PutBlobInput {
  key: string;
  body: ArrayBuffer;
  contentType?: string | undefined;
  contentDisposition?: string | undefined;
}

export interface BlobObject {
  key: string;
  body: ArrayBuffer;
  size: number;
  contentType?: string | undefined;
}

export interface BlobStore {
  put(input: PutBlobInput): Promise<void>;
  get(key: string): Promise<BlobObject | null>;
}

export class BlobStoreConfigError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "BlobStoreConfigError";
  }
}

const sanitizeFileName = (fileName: string): string => {
  const normalized = fileName.trim().replace(/\s+/g, "-").toLowerCase();

  return normalized.replace(/[^a-z0-9._-]/g, "");
};

// 这里统一生成 R2 key，避免 route 和 service 各自拼路径。
export const createRawAssetBlobKey = (
  assetId: string,
  fileName: string
): string => {
  const safeFileName = sanitizeFileName(fileName) || "upload.bin";

  return `assets/${assetId}/raw/${safeFileName}`;
};

// 这里封装最小 R2 适配器，后续切到 S3-compatible storage 时只替换这一层。
export class R2BlobStore implements BlobStore {
  private readonly bucket: R2Bucket;

  public constructor(bucket: R2Bucket) {
    this.bucket = bucket;
  }

  public async put(input: PutBlobInput): Promise<void> {
    const httpMetadata: R2HTTPMetadata = {};

    if (input.contentType) {
      httpMetadata.contentType = input.contentType;
    }

    if (input.contentDisposition) {
      httpMetadata.contentDisposition = input.contentDisposition;
    }

    await this.bucket.put(input.key, input.body, {
      httpMetadata,
    });
  }

  public async get(key: string): Promise<BlobObject | null> {
    const object = await this.bucket.get(key);

    if (!object) {
      return null;
    }

    return {
      key,
      body: await object.arrayBuffer(),
      size: object.size,
      contentType: object.httpMetadata?.contentType,
    };
  }
}
