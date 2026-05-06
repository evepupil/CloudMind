import { createPromptRegistry } from "@/core/prompts/registry";

import { assertionV1 } from "./assertion-v1";
import { enrichmentCandidateV1 } from "./enrichment-candidate-v1";
import { enrichmentClassificationV1 } from "./enrichment-classification-v1";
import { enrichmentDescriptorV1 } from "./enrichment-descriptor-v1";
import { enrichmentSelectionV1 } from "./enrichment-selection-v1";
import { summaryV1 } from "./summary-v1";
import { titleV1 } from "./title-v1";

export const createIngestPromptRegistry = () => {
  const registry = createPromptRegistry();

  registry.register(summaryV1);
  registry.register(titleV1);
  registry.register(enrichmentCandidateV1);
  registry.register(enrichmentClassificationV1);
  registry.register(enrichmentDescriptorV1);
  registry.register(enrichmentSelectionV1);
  registry.register(assertionV1);

  return registry;
};

export const ingestPromptRegistry = createIngestPromptRegistry();

export { parseJsonObject } from "./utils";
