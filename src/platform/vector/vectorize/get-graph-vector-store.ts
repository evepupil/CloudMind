import type { VectorStore } from "@/core/vector/ports";
import type { AppBindings } from "@/env";

import { VectorizeStore } from "./vectorize-store";

const getGraphVectorizeBinding = (
  bindings: AppBindings | undefined
): Vectorize => {
  if (!bindings?.GRAPH_VECTORS) {
    throw new Error(
      'Cloudflare Vectorize binding "GRAPH_VECTORS" is not configured. ' +
        "Create the graph_entities index and bind it in wrangler.jsonc."
    );
  }

  return bindings.GRAPH_VECTORS;
};

// 这里集中解析 graph_entities Vectorize binding，供 L2 实体消歧使用。
export const getGraphVectorStoreFromBindings = (
  bindings: AppBindings | undefined
): VectorStore => {
  return new VectorizeStore(getGraphVectorizeBinding(bindings));
};
