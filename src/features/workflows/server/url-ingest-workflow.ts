import type { AIProvider } from "@/core/ai/ports";
import type { AssetIngestRepository } from "@/core/assets/ports";
import { createRawAssetBlobKey } from "@/core/blob/keys";
import type { BlobStore } from "@/core/blob/ports";
import type { JobQueue } from "@/core/queue/ports";
import type { VectorStore } from "@/core/vector/ports";
import type { WebPageFetcher, WebPageFetchResult } from "@/core/web/ports";
import type { WorkflowRepository } from "@/core/workflows/ports";
import type { AssetDetail } from "@/features/assets/model/types";
import { enqueueWorkflow, type WorkflowDefinition } from "./runtime";
import { buildSharedIngestSteps } from "./shared-workflow-steps";

const getWebPageFetcher = (context: {
  services: {
    webPageFetcher?: WebPageFetcher | undefined;
  };
}): WebPageFetcher => {
  if (!context.services.webPageFetcher) {
    throw new Error("Web page fetcher is not configured.");
  }

  return context.services.webPageFetcher;
};

const getRefinedAssetTitle = (
  asset: AssetDetail,
  fetchedTitle: string | null
): string | null => {
  const normalizedFetchedTitle = fetchedTitle?.trim();

  if (!normalizedFetchedTitle) {
    return null;
  }

  const currentTitle = asset.title.trim();
  const sourceUrl = asset.sourceUrl?.trim();

  if (!currentTitle || (sourceUrl && currentTitle === sourceUrl)) {
    return normalizedFetchedTitle;
  }

  return null;
};

export const createUrlIngestWorkflowDefinition = (): WorkflowDefinition => ({
  type: "url_ingest_v1",
  steps: [
    {
      key: "load_source",
      type: "load_source",
      execute: async (context) => {
        const sourceUrl = context.asset.sourceUrl?.trim();

        if (!sourceUrl) {
          throw new Error("Asset URL is empty and cannot be processed.");
        }

        const fetcher = getWebPageFetcher(context);
        const rawR2Key = createRawAssetBlobKey(context.asset.id, "source.md");

        // L1 不可变铁律：原始快照只在首次抓取写入一次。
        // 已存在即从存档原文重算下游（reprocess），绝不重抓、绝不覆盖——
        // 否则会用「当下的页面」毁掉「当初存下的页面」（50 年时间胶囊）。
        const archived = await context.services.blobStore.get(rawR2Key);

        let fetchedPage: WebPageFetchResult;

        if (archived) {
          fetchedPage = fetcher.parseArchived(
            new TextDecoder().decode(archived.body),
            sourceUrl
          );
        } else {
          fetchedPage = await fetcher.fetchUrl(sourceUrl);

          await context.services.blobStore.put({
            key: rawR2Key,
            body: new TextEncoder()
              .encode(fetchedPage.rawContent)
              .buffer.slice(0) as ArrayBuffer,
            contentType: "text/markdown; charset=utf-8",
          });
        }

        return {
          output: {
            sourceUrl: fetchedPage.sourceUrl,
            rawR2Key,
            provider: fetchedPage.provider,
            fetchedLength: fetchedPage.content.length,
            // 观测用：archive=从不可变存档重算，fetch=首次联网抓取。
            source: archived ? "archive" : "fetch",
          },
          state: {
            sourceUrl: fetchedPage.sourceUrl,
            fetchedTitle: fetchedPage.title,
            fetchedAt: fetchedPage.fetchedAt,
            rawR2Key,
            extractedContent: fetchedPage.content,
          },
        };
      },
    },
    ...buildSharedIngestSteps({
      cleanContent: {
        getContent: (_asset, state) => {
          const content = state.extractedContent;

          if (typeof content !== "string") {
            throw new Error("Workflow state is missing fetched content.");
          }

          return content;
        },
      },
      persistContent: {
        buildExtraMetadata: (state) => ({
          sourceUrl:
            typeof state.sourceUrl === "string" ? state.sourceUrl : null,
          fetchedAt:
            typeof state.fetchedAt === "string" ? state.fetchedAt : null,
        }),
      },
      finalize: {
        getRawR2Key: (state) =>
          typeof state.rawR2Key === "string" ? state.rawR2Key : null,
        afterFinalize: async (context) => {
          const sourceUrl = context.state.sourceUrl;
          const refinedTitle = getRefinedAssetTitle(
            context.asset,
            typeof context.state.fetchedTitle === "string"
              ? context.state.fetchedTitle
              : null
          );

          if (refinedTitle || typeof sourceUrl === "string") {
            await context.services.assetRepository.updateAssetMetadata(
              context.asset.id,
              {
                title: refinedTitle ?? undefined,
                sourceUrl:
                  typeof sourceUrl === "string" ? sourceUrl : undefined,
              }
            );
          }
        },
      },
    }),
  ],
});

export const runUrlIngestWorkflow = async (
  assetRepository: AssetIngestRepository,
  workflowRepository: WorkflowRepository,
  blobStore: BlobStore,
  vectorStore: VectorStore,
  aiProvider: AIProvider,
  jobQueue: JobQueue,
  webPageFetcher: WebPageFetcher,
  assetId: string,
  triggerType: "ingest" | "reprocess",
  options?: {
    force?: boolean;
  }
): Promise<AssetDetail> => {
  return enqueueWorkflow(
    createUrlIngestWorkflowDefinition(),
    assetId,
    triggerType,
    {
      assetRepository,
      workflowRepository,
      blobStore,
      vectorStore,
      aiProvider,
      jobQueue,
      webPageFetcher,
    },
    options
  );
};
