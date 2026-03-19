import type { AIProvider } from "@/core/ai/ports";
import type { AppBindings } from "@/env";

import { WorkersAIProvider } from "./workers-ai-provider";

const getAIBinding = (bindings: AppBindings | undefined): Ai => {
  if (!bindings?.AI) {
    throw new Error(
      'Cloudflare Workers AI binding "AI" is not configured. ' +
        "Bind AI in wrangler.jsonc before using semantic indexing or search."
    );
  }

  return bindings.AI;
};

// 这里集中解析 Workers AI binding，避免业务层直接访问 env.AI。
export const getAIProviderFromBindings = (
  bindings: AppBindings | undefined
): AIProvider => {
  return new WorkersAIProvider(getAIBinding(bindings));
};
