import { createRoute } from "honox/factory";

import { AssetNotFoundError } from "@/core/assets/errors";
import { WorkflowRunNotFoundError } from "@/core/workflows/errors";
import { getAssetById } from "@/features/assets/server/service";
import { AssetWorkflowsPage } from "@/features/workflows/components/asset-workflows-page";
import {
  getWorkflowRunDetail,
  listWorkflowRunsByAssetId,
} from "@/features/workflows/server/service";

// 这里提供独立的 workflow inspection 页面，避免把执行细节继续堆进资产详情页。
export default createRoute(async (context) => {
  const id = context.req.param("id");

  if (!id) {
    context.status(404);

    return context.render(
      <AssetWorkflowsPage errorMessage="Asset not found." />
    );
  }

  try {
    const item = await getAssetById(context.env, id);
    const runs = await listWorkflowRunsByAssetId(context.env, id);
    const requestedRunId = context.req.query("runId") ?? undefined;
    const selectedRunId = requestedRunId ?? runs[0]?.id;
    let selectedRun = null;
    let errorMessage = context.req.query("error") ?? undefined;

    if (selectedRunId) {
      try {
        const detail = await getWorkflowRunDetail(context.env, selectedRunId);

        if (detail.run.assetId === item.id) {
          selectedRun = detail;
        } else {
          errorMessage =
            "The selected workflow run does not belong to this asset.";
        }
      } catch (error) {
        if (error instanceof WorkflowRunNotFoundError) {
          errorMessage = "Workflow run not found.";
        } else {
          throw error;
        }
      }
    }

    return context.render(
      <AssetWorkflowsPage
        item={item}
        runs={runs}
        selectedRun={selectedRun}
        selectedRunId={selectedRunId}
        errorMessage={errorMessage}
      />
    );
  } catch (error) {
    if (error instanceof AssetNotFoundError) {
      context.status(404);

      return context.render(
        <AssetWorkflowsPage errorMessage="Asset not found." />
      );
    }

    context.status(500);

    return context.render(
      <AssetWorkflowsPage
        errorMessage={
          error instanceof Error
            ? error.message
            : "Failed to load workflow inspection."
        }
      />
    );
  }
});
