import type { VectorStore } from "@/core/vector/ports";
import type { AppBindings } from "@/env";

import { VectorizeStore } from "./vectorize-store";

const getVectorizeBinding = (bindings: AppBindings | undefined): Vectorize => {
  if (!bindings?.ASSET_VECTORS) {
    throw new Error(
      'Cloudflare Vectorize binding "ASSET_VECTORS" is not configured. ' +
        "Create the index and bind it in wrangler.jsonc before using semantic search."
    );
  }

  return bindings.ASSET_VECTORS;
};

// 这里集中解析 Vectorize binding，避免业务层直接访问 env。
export const getVectorStoreFromBindings = (
  bindings: AppBindings | undefined
): VectorStore => {
  return new VectorizeStore(getVectorizeBinding(bindings));
};
