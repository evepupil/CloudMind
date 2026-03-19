import type { BlobStore } from "@/core/blob/ports";
import type { AppBindings } from "@/env";

import { R2BlobStore } from "./r2-blob-store";

const getBucketBinding = (bindings: AppBindings | undefined): R2Bucket => {
  if (!bindings?.ASSET_FILES) {
    throw new Error(
      'Cloudflare R2 binding "ASSET_FILES" is not configured. ' +
        "Create the bucket and bind it in wrangler.jsonc before using file ingest."
    );
  }

  return bindings.ASSET_FILES;
};

// 这里集中解析 R2 绑定，避免业务层直接依赖具体对象存储实现。
export const getBlobStoreFromBindings = (
  bindings: AppBindings | undefined
): BlobStore => {
  return new R2BlobStore(getBucketBinding(bindings));
};
