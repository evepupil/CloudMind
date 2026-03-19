import { createRoute } from "honox/factory";

import { AssetDetailPage } from "@/features/assets/components/asset-detail-page";
import { AssetNotFoundError } from "@/features/assets/server/repository";
import { getAssetById } from "@/features/assets/server/service";

// 这里提供最小详情页，方便检查 ingest 写入后的实际记录。
export default createRoute(async (context) => {
  const id = context.req.param("id");

  if (!id) {
    context.status(404);

    return context.render(<AssetDetailPage errorMessage="Asset not found." />);
  }

  try {
    const item = await getAssetById(context.env, id);

    return context.render(<AssetDetailPage item={item} />);
  } catch (error) {
    if (error instanceof AssetNotFoundError) {
      context.status(404);

      return context.render(
        <AssetDetailPage errorMessage="Asset not found." />
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
