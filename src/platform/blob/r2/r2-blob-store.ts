import type { BlobObject, BlobStore, PutBlobInput } from "@/core/blob/ports";

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
