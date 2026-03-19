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

// 这里定义对象存储端口，后续可从 R2 切到任意 S3-compatible 实现。
export interface BlobStore {
  put(input: PutBlobInput): Promise<void>;
  get(key: string): Promise<BlobObject | null>;
}
