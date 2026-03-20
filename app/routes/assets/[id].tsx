import { createRoute } from "honox/factory";

import { AssetNotFoundError } from "@/core/assets/errors";
import { AssetDetailPage } from "@/features/assets/components/asset-detail-page";
import { getAssetById } from "@/features/assets/server/service";

const getFlashMessage = (
  created: string | undefined,
  reprocessed: string | undefined,
  updated: string | undefined
): string | undefined => {
  if (updated) {
    return "Asset updated successfully.";
  }

  if (reprocessed) {
    return "Asset reprocessed successfully.";
  }

  if (created) {
    return "Asset saved successfully.";
  }

  return undefined;
};

// 这里提供最小详情页 route，直接复用 service 并解析页面提示参数。
export default createRoute(async (context) => {
  const id = context.req.param("id");
  const flashMessage = getFlashMessage(
    context.req.query("created"),
    context.req.query("reprocessed"),
    context.req.query("updated")
  );
  const errorMessage = context.req.query("error") ?? undefined;

  if (!id) {
    context.status(404);

    return context.render(<AssetDetailPage errorMessage="Asset not found." />);
  }

  try {
    const item = await getAssetById(context.env, id);

    return context.render(
      <AssetDetailPage
        item={item}
        errorMessage={errorMessage}
        flashMessage={flashMessage}
      />
    );
  } catch (error) {
    if (error instanceof AssetNotFoundError) {
      context.status(404);

      return context.render(
        <AssetDetailPage errorMessage={errorMessage ?? "Asset not found."} />
      );
    }

    context.status(500);

    return context.render(
      <AssetDetailPage
        errorMessage={
          error instanceof Error ? error.message : "Failed to load asset."
        }
      />
    );
  }
});
