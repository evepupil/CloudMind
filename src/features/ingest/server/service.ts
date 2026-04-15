import type { AIProvider } from "@/core/ai/ports";
import type {
  AssetIngestRepository,
  CreateTextAssetInput,
  CreateUrlAssetInput,
} from "@/core/assets/ports";
import { createRawAssetBlobKey } from "@/core/blob/keys";
import type { BlobStore } from "@/core/blob/ports";
import type { JobQueue } from "@/core/queue/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { WebPageFetcher } from "@/core/web/ports";
import type { WorkflowRepository } from "@/core/workflows/ports";
import type { AppBindings } from "@/env";
import type { AssetDetail } from "@/features/assets/model/types";
import {
  type TextAssetEnrichmentInput,
  textAssetEnrichmentSchema,
} from "@/features/ingest/model/enrichment";
import { getAIProviderFromBindings } from "@/platform/ai/workers-ai/get-ai-provider";
import { getBlobStoreFromBindings } from "@/platform/blob/r2/get-blob-store";
import { getAssetIngestRepositoryFromBindings } from "@/platform/db/d1/repositories/get-asset-repository";
import { getWorkflowRepositoryFromBindings } from "@/platform/db/d1/repositories/get-workflow-repository";
import { createLogger } from "@/platform/observability/logger";
import { getJobQueueFromBindings } from "@/platform/queue/cloudflare/get-job-queue";
import { getVectorStoreFromBindings } from "@/platform/vector/vectorize/get-vector-store";
import { getWebPageFetcherFromBindings } from "@/platform/web/jina/get-web-page-fetcher";
import { inferAIProviderName } from "./ai-observability";
import {
  generateAutoTextEnrichment,
  standardizeProvidedTextEnrichment,
} from "./auto-enrichment";
import {
  processPdfAsset,
  processTextAsset,
  processUrlAsset,
} from "./processor";

interface BackfillChunkContentInput {
  dryRun?: boolean | undefined;
  limit?: number | undefined;
}

interface BackfillChunkContentResult {
  dryRun: boolean;
  candidateAssetIds: string[];
  processedAssetIds: string[];
  failedItems: Array<{
    assetId: string;
    errorMessage: string;
  }>;
}

interface IngestServiceDependencies {
  getAssetRepository: (
    bindings: AppBindings | undefined
  ) => AssetIngestRepository | Promise<AssetIngestRepository>;
  getBlobStore: (
    bindings: AppBindings | undefined
  ) => BlobStore | Promise<BlobStore>;
  getVectorStore: (
    bindings: AppBindings | undefined
  ) => VectorStore | Promise<VectorStore>;
  getWorkflowRepository: (
    bindings: AppBindings | undefined
  ) => WorkflowRepository | Promise<WorkflowRepository>;
  getJobQueue: (
    bindings: AppBindings | undefined
  ) => JobQueue | Promise<JobQueue>;
  getAIProvider: (
    bindings: AppBindings | undefined
  ) => AIProvider | Promise<AIProvider>;
  getWebPageFetcher: (
    bindings: AppBindings | undefined
  ) => WebPageFetcher | Promise<WebPageFetcher>;
  processTextAsset: (
    repository: AssetIngestRepository,
    workflowRepository: WorkflowRepository,
    blobStore: BlobStore,
    vectorStore: VectorStore,
    aiProvider: AIProvider,
    jobQueue: JobQueue,
    assetId: string,
    options?: {
      force?: boolean;
      enrichment?: TextAssetEnrichmentInput;
    }
  ) => Promise<AssetDetail>;
  processUrlAsset: (
    repository: AssetIngestRepository,
    workflowRepository: WorkflowRepository,
    blobStore: BlobStore,
    vectorStore: VectorStore,
    aiProvider: AIProvider,
    jobQueue: JobQueue,
    webPageFetcher: WebPageFetcher,
    assetId: string
  ) => Promise<AssetDetail>;
  processPdfAsset: (
    repository: AssetIngestRepository,
    workflowRepository: WorkflowRepository,
    blobStore: BlobStore,
    vectorStore: VectorStore,
    aiProvider: AIProvider,
    jobQueue: JobQueue,
    assetId: string
  ) => Promise<AssetDetail>;
  getProcessTextAssetForced: (
    repository: AssetIngestRepository,
    workflowRepository: WorkflowRepository,
    blobStore: BlobStore,
    vectorStore: VectorStore,
    aiProvider: AIProvider,
    jobQueue: JobQueue,
    assetId: string,
    options?: {
      force?: boolean;
      enrichment?: TextAssetEnrichmentInput;
    }
  ) => Promise<AssetDetail>;
  getProcessUrlAssetForced: (
    repository: AssetIngestRepository,
    workflowRepository: WorkflowRepository,
    blobStore: BlobStore,
    vectorStore: VectorStore,
    aiProvider: AIProvider,
    jobQueue: JobQueue,
    webPageFetcher: WebPageFetcher,
    assetId: string
  ) => Promise<AssetDetail>;
  getProcessPdfAssetForced: (
    repository: AssetIngestRepository,
    workflowRepository: WorkflowRepository,
    blobStore: BlobStore,
    vectorStore: VectorStore,
    aiProvider: AIProvider,
    jobQueue: JobQueue,
    assetId: string
  ) => Promise<AssetDetail>;
}

const defaultDependencies: IngestServiceDependencies = {
  getAssetRepository: getAssetIngestRepositoryFromBindings,
  getBlobStore: getBlobStoreFromBindings,
  getVectorStore: getVectorStoreFromBindings,
  getWorkflowRepository: getWorkflowRepositoryFromBindings,
  getJobQueue: getJobQueueFromBindings,
  getAIProvider: getAIProviderFromBindings,
  getWebPageFetcher: getWebPageFetcherFromBindings,
  processTextAsset,
  processUrlAsset,
  processPdfAsset,
  getProcessTextAssetForced: (
    repository,
    workflowRepository,
    blobStore,
    vectorStore,
    aiProvider,
    jobQueue,
    assetId,
    options
  ) =>
    processTextAsset(
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      assetId,
      options?.enrichment
        ? {
            force: true,
            enrichment: options.enrichment,
          }
        : {
            force: true,
          }
    ),
  getProcessUrlAssetForced: (
    repository,
    workflowRepository,
    blobStore,
    vectorStore,
    aiProvider,
    jobQueue,
    webPageFetcher,
    assetId
  ) =>
    processUrlAsset(
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      webPageFetcher,
      assetId,
      { force: true }
    ),
  getProcessPdfAssetForced: (
    repository,
    workflowRepository,
    blobStore,
    vectorStore,
    aiProvider,
    jobQueue,
    assetId
  ) =>
    processPdfAsset(
      repository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      assetId,
      {
        force: true,
      }
    ),
};
const ingestLogger = createLogger("ingest");

const parsePersistedTextEnrichment = (
  stateJson: string | null
): TextAssetEnrichmentInput | undefined => {
  if (!stateJson) {
    return undefined;
  }

  try {
    const parsedState = JSON.parse(stateJson) as {
      enrichment?: unknown;
    };
    const parsedEnrichment = textAssetEnrichmentSchema.safeParse(
      parsedState.enrichment
    );

    if (!parsedEnrichment.success) {
      return undefined;
    }

    return parsedEnrichment.data;
  } catch {
    return undefined;
  }
};

const getLatestPersistedTextEnrichment = async (
  workflowRepository: WorkflowRepository,
  assetId: string
): Promise<TextAssetEnrichmentInput | undefined> => {
  const runs = await workflowRepository.listWorkflowRunsByAssetId(assetId);

  for (const run of runs) {
    const enrichment = parsePersistedTextEnrichment(run.stateJson);

    if (enrichment) {
      return enrichment;
    }
  }

  return undefined;
};

const reprocessExistingAsset = async (
  dependencies: IngestServiceDependencies,
  bindings: AppBindings | undefined,
  repository: AssetIngestRepository,
  asset: AssetDetail
): Promise<AssetDetail> => {
  switch (asset.type) {
    case "note":
    case "chat": {
      const [blobStore, vectorStore, workflowRepository, aiProvider, jobQueue] =
        await Promise.all([
          dependencies.getBlobStore(bindings),
          dependencies.getVectorStore(bindings),
          dependencies.getWorkflowRepository(bindings),
          dependencies.getAIProvider(bindings),
          dependencies.getJobQueue(bindings),
        ]);

      const enrichment = await getLatestPersistedTextEnrichment(
        workflowRepository,
        asset.id
      );

      if (enrichment) {
        return dependencies.getProcessTextAssetForced(
          repository,
          workflowRepository,
          blobStore,
          vectorStore,
          aiProvider,
          jobQueue,
          asset.id,
          {
            enrichment,
          }
        );
      }

      return dependencies.getProcessTextAssetForced(
        repository,
        workflowRepository,
        blobStore,
        vectorStore,
        aiProvider,
        jobQueue,
        asset.id
      );
    }
    case "url": {
      const [blobStore, vectorStore, workflowRepository, aiProvider, jobQueue] =
        await Promise.all([
          dependencies.getBlobStore(bindings),
          dependencies.getVectorStore(bindings),
          dependencies.getWorkflowRepository(bindings),
          dependencies.getAIProvider(bindings),
          dependencies.getJobQueue(bindings),
        ]);

      return dependencies.getProcessUrlAssetForced(
        repository,
        workflowRepository,
        blobStore,
        vectorStore,
        aiProvider,
        jobQueue,
        await dependencies.getWebPageFetcher(bindings),
        asset.id
      );
    }
    case "pdf": {
      const [blobStore, vectorStore, workflowRepository, aiProvider, jobQueue] =
        await Promise.all([
          dependencies.getBlobStore(bindings),
          dependencies.getVectorStore(bindings),
          dependencies.getWorkflowRepository(bindings),
          dependencies.getAIProvider(bindings),
          dependencies.getJobQueue(bindings),
        ]);

      return dependencies.getProcessPdfAssetForced(
        repository,
        workflowRepository,
        blobStore,
        vectorStore,
        aiProvider,
        jobQueue,
        asset.id
      );
    }
    default:
      throw new Error(
        `Asset type "${asset.type}" is not supported for reprocess.`
      );
  }
};

// 这里集中采集与重处理用例，避免继续和资产读模型耦合。
export const createIngestService = (
  dependencies: IngestServiceDependencies = defaultDependencies
) => {
  return {
    async ingestTextAsset(
      bindings: AppBindings | undefined,
      input: CreateTextAssetInput
    ): Promise<AssetDetail> {
      const startedAt = Date.now();

      try {
        const repository = await dependencies.getAssetRepository(bindings);
        const blobStore = await dependencies.getBlobStore(bindings);
        const vectorStore = await dependencies.getVectorStore(bindings);
        const workflowRepository =
          await dependencies.getWorkflowRepository(bindings);
        const jobQueue = await dependencies.getJobQueue(bindings);
        const aiProvider = await dependencies.getAIProvider(bindings);
        let resolvedEnrichment = input.enrichment;

        if (resolvedEnrichment) {
          resolvedEnrichment = await standardizeProvidedTextEnrichment(
            aiProvider,
            vectorStore,
            {
              title: input.title,
              content: input.content,
              sourceKind: input.sourceKind,
              enrichment: resolvedEnrichment,
            }
          ).catch((error) => {
            ingestLogger.warn(
              "provided_enrichment_standardization_skipped",
              {
                aiProvider: inferAIProviderName(aiProvider),
                sourceKind: input.sourceKind ?? "manual",
                fallbackStrategy: "keep_original",
              },
              { error }
            );

            return resolvedEnrichment;
          });
        } else {
          resolvedEnrichment = await generateAutoTextEnrichment(
            aiProvider,
            vectorStore,
            {
              title: input.title,
              content: input.content,
            }
          ).catch(() => undefined);

          if (!resolvedEnrichment) {
            try {
              const fallbackAiProvider = getAIProviderFromBindings(bindings);

              if (fallbackAiProvider !== aiProvider) {
                resolvedEnrichment = await generateAutoTextEnrichment(
                  fallbackAiProvider,
                  vectorStore,
                  {
                    title: input.title,
                    content: input.content,
                  }
                ).catch(() => undefined);
              }
            } catch {}
          }
        }
        const createdAsset = await repository.createTextAsset({
          ...input,
          enrichment: resolvedEnrichment,
        });

        const result = resolvedEnrichment
          ? await dependencies.processTextAsset(
              repository,
              workflowRepository,
              blobStore,
              vectorStore,
              aiProvider,
              jobQueue,
              createdAsset.id,
              {
                enrichment: resolvedEnrichment,
              }
            )
          : await dependencies.processTextAsset(
              repository,
              workflowRepository,
              blobStore,
              vectorStore,
              aiProvider,
              jobQueue,
              createdAsset.id
            );

        ingestLogger.info("ingest_completed", {
          durationMs: Date.now() - startedAt,
          assetId: result.id,
          assetType: result.type,
          sourceKind: result.sourceKind,
          status: result.status,
          enrichmentSource: input.enrichment
            ? "client"
            : resolvedEnrichment
              ? "auto"
              : "none",
        });

        return result;
      } catch (error) {
        ingestLogger.error(
          "ingest_failed",
          {
            durationMs: Date.now() - startedAt,
            assetType: "text",
            sourceKind: input.sourceKind,
            hasClientEnrichment: Boolean(input.enrichment),
          },
          { error }
        );

        throw error;
      }
    },

    async ingestUrlAsset(
      bindings: AppBindings | undefined,
      input: CreateUrlAssetInput
    ): Promise<AssetDetail> {
      const startedAt = Date.now();

      try {
        const repository = await dependencies.getAssetRepository(bindings);
        const blobStore = await dependencies.getBlobStore(bindings);
        const vectorStore = await dependencies.getVectorStore(bindings);
        const workflowRepository =
          await dependencies.getWorkflowRepository(bindings);
        const jobQueue = await dependencies.getJobQueue(bindings);
        const aiProvider = await dependencies.getAIProvider(bindings);
        const webPageFetcher = await dependencies.getWebPageFetcher(bindings);
        const createdAsset = await repository.createUrlAsset(input);
        const result = await dependencies.processUrlAsset(
          repository,
          workflowRepository,
          blobStore,
          vectorStore,
          aiProvider,
          jobQueue,
          webPageFetcher,
          createdAsset.id
        );

        ingestLogger.info("ingest_completed", {
          durationMs: Date.now() - startedAt,
          assetId: result.id,
          assetType: result.type,
          sourceKind: result.sourceKind,
          status: result.status,
        });

        return result;
      } catch (error) {
        ingestLogger.error(
          "ingest_failed",
          {
            durationMs: Date.now() - startedAt,
            assetType: "url",
            sourceKind: input.sourceKind,
          },
          { error }
        );

        throw error;
      }
    },

    async ingestFileAsset(
      bindings: AppBindings | undefined,
      input: {
        title?: string | undefined;
        file: File;
      }
    ): Promise<AssetDetail> {
      const startedAt = Date.now();

      try {
        const repository = await dependencies.getAssetRepository(bindings);
        const blobStore = await dependencies.getBlobStore(bindings);
        const vectorStore = await dependencies.getVectorStore(bindings);
        const workflowRepository =
          await dependencies.getWorkflowRepository(bindings);
        const jobQueue = await dependencies.getJobQueue(bindings);
        const aiProvider = await dependencies.getAIProvider(bindings);
        const assetId = crypto.randomUUID();
        const rawR2Key = createRawAssetBlobKey(assetId, input.file.name);
        const contentDisposition = `inline; filename="${input.file.name.replace(
          /"/g,
          '\\"'
        )}"`;

        await blobStore.put({
          key: rawR2Key,
          body: await input.file.arrayBuffer(),
          contentType: input.file.type || "application/pdf",
          contentDisposition,
        });

        const createdAsset = await repository.createFileAsset({
          id: assetId,
          title: input.title,
          fileName: input.file.name,
          fileSize: input.file.size,
          mimeType: input.file.type || "application/pdf",
          rawR2Key,
        });

        const result = await dependencies.processPdfAsset(
          repository,
          workflowRepository,
          blobStore,
          vectorStore,
          aiProvider,
          jobQueue,
          createdAsset.id
        );

        ingestLogger.info("ingest_completed", {
          durationMs: Date.now() - startedAt,
          assetId: result.id,
          assetType: result.type,
          sourceKind: result.sourceKind,
          status: result.status,
          fileName: input.file.name,
          fileSize: input.file.size,
        });

        return result;
      } catch (error) {
        ingestLogger.error(
          "ingest_failed",
          {
            durationMs: Date.now() - startedAt,
            assetType: "pdf",
            sourceKind: "upload",
            fileName: input.file.name,
            fileSize: input.file.size,
          },
          { error }
        );

        throw error;
      }
    },

    async reprocessAsset(
      bindings: AppBindings | undefined,
      id: string
    ): Promise<AssetDetail> {
      const startedAt = Date.now();

      try {
        const repository = await dependencies.getAssetRepository(bindings);
        const asset = await repository.getAssetById(id);
        const result = await reprocessExistingAsset(
          dependencies,
          bindings,
          repository,
          asset
        );

        ingestLogger.info("reprocess_completed", {
          durationMs: Date.now() - startedAt,
          assetId: result.id,
          assetType: result.type,
          status: result.status,
        });

        return result;
      } catch (error) {
        ingestLogger.error(
          "reprocess_failed",
          {
            durationMs: Date.now() - startedAt,
            assetId: id,
          },
          { error }
        );

        throw error;
      }
    },

    async backfillChunkContent(
      bindings: AppBindings | undefined,
      input?: BackfillChunkContentInput
    ): Promise<BackfillChunkContentResult> {
      const startedAt = Date.now();

      try {
        const repository = await dependencies.getAssetRepository(bindings);
        const candidateAssetIds =
          await repository.listAssetIdsMissingChunkContent(input?.limit ?? 50);

        if (input?.dryRun ?? false) {
          const dryRunResult = {
            dryRun: true,
            candidateAssetIds,
            processedAssetIds: [],
            failedItems: [],
          };

          ingestLogger.info("chunk_content_backfill_completed", {
            durationMs: Date.now() - startedAt,
            dryRun: true,
            candidateCount: candidateAssetIds.length,
            processedCount: 0,
            failedCount: 0,
          });

          return dryRunResult;
        }

        const processedAssetIds: string[] = [];
        const failedItems: BackfillChunkContentResult["failedItems"] = [];

        for (const assetId of candidateAssetIds) {
          try {
            const asset = await repository.getAssetById(assetId);

            await reprocessExistingAsset(
              dependencies,
              bindings,
              repository,
              asset
            );
            processedAssetIds.push(assetId);
          } catch (error) {
            failedItems.push({
              assetId,
              errorMessage:
                error instanceof Error
                  ? error.message
                  : "Unknown backfill error.",
            });
          }
        }

        const result = {
          dryRun: false,
          candidateAssetIds,
          processedAssetIds,
          failedItems,
        };

        ingestLogger.info("chunk_content_backfill_completed", {
          durationMs: Date.now() - startedAt,
          dryRun: false,
          candidateCount: candidateAssetIds.length,
          processedCount: processedAssetIds.length,
          failedCount: failedItems.length,
        });

        return result;
      } catch (error) {
        ingestLogger.error(
          "chunk_content_backfill_failed",
          {
            durationMs: Date.now() - startedAt,
            dryRun: input?.dryRun ?? false,
            limit: input?.limit ?? 50,
          },
          { error }
        );

        throw error;
      }
    },
  };
};

const ingestService = createIngestService();

export const {
  ingestTextAsset,
  ingestUrlAsset,
  ingestFileAsset,
  reprocessAsset,
  backfillChunkContent,
} = ingestService;
