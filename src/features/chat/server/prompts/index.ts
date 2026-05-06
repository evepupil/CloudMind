import { createPromptRegistry } from "@/core/prompts/registry";

import { ragSystemV1 } from "./rag-system-v1";
import { ragUserV1 } from "./rag-user-v1";

export const createChatPromptRegistry = () => {
  const registry = createPromptRegistry();

  registry.register(ragSystemV1);
  registry.register(ragUserV1);

  return registry;
};

export const chatPromptRegistry = createChatPromptRegistry();
