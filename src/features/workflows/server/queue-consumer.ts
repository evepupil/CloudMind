import type { JobQueueMessage } from "@/core/queue/ports";
import type { AppBindings } from "@/env";
import { getAIProviderFromBindings } from "@/platform/ai/workers-ai/get-ai-provider";
import { getBlobStoreFromBindings } from "@/platform/blob/r2/get-blob-store";
import { getAssetIngestRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";
import { getWorkflowRepositoryFromBindings } from "@/platform/db/d1/repositories/get-workflow-repository";
import { getJobQueueFromBindings } from "@/platform/queue/cloudflare/get-job-queue";
import { getVectorStoreFromBindings } from "@/platform/vector/vectorize/get-vector-store";
import { getWebPageFetcherFromBindings } from "@/platform/web/jina/get-web-page-fetcher";

import { getWorkflowDefinition } from "./registry";
import {
  consumeWorkflowStepMessage,
  parseWorkflowStepQueuePayload,
} from "./runtime";

// 这里把 Queue consumer 的环境装配收口，避免 app/server.ts 直接堆基础设施细节。
export const consumeWorkflowQueueMessage = async (
  message: JobQueueMessage,
  bindings: AppBindings | undefined
): Promise<void> => {
  const payload = parseWorkflowStepQueuePayload(message);

  if (!payload) {
    throw new Error(
      `Unsupported workflow queue message type "${message.type}".`
    );
  }

  const assetRepository = await getAssetIngestRepositoryFromBindings(bindings);
  const workflowRepository = await getWorkflowRepositoryFromBindings(bindings);
  const run = await workflowRepository.getWorkflowRunById(payload.runId);
  const definition = getWorkflowDefinition(run.workflowType);

  await consumeWorkflowStepMessage(definition, payload, {
    assetRepository,
    workflowRepository,
    blobStore: await getBlobStoreFromBindings(bindings),
    vectorStore: await getVectorStoreFromBindings(bindings),
    aiProvider: await getAIProviderFromBindings(bindings),
    jobQueue: getJobQueueFromBindings(bindings),
    webPageFetcher: getWebPageFetcherFromBindings(bindings),
  });
};
