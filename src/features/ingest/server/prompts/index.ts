import { createPromptRegistry } from "@/core/prompts/registry";

import { summaryV1 } from "./summary-v1";
import { titleV1 } from "./title-v1";

export const createIngestPromptRegistry = () => {
  const registry = createPromptRegistry();

  registry.register(summaryV1);
  registry.register(titleV1);

  return registry;
};

export const ingestPromptRegistry = createIngestPromptRegistry();

export { parseJsonObject } from "./utils";
