import { createRoute } from "honox/factory";

import { AssetsPage } from "@/features/assets/components/assets-page";
import { assetListQuerySchema } from "@/features/assets/server/schemas";
import { listAssets } from "@/features/assets/server/service";

const getFlashMessage = (
  created: string | undefined,
  deleted: string | undefined
): string | undefined => {
  if (deleted) {
    return "Asset deleted successfully.";
  }

  if (created) {
    return "Asset saved successfully.";
  }

  return undefined;
};

// 这里让列表页直接复用资产 service，并解析页面级提示参数。
export default createRoute(async (context) => {
  try {
    const parsedQuery = assetListQuerySchema.safeParse(context.req.query());
    const filters = parsedQuery.success ? parsedQuery.data : {};
    const result = await listAssets(context.env, filters);
    const errorMessage = context.req.query("error");
    const flashMessage = getFlashMessage(
      context.req.query("created"),
      context.req.query("deleted")
    );

    return context.render(
      <AssetsPage
        items={result.items}
        pagination={result.pagination}
        filters={filters}
        errorMessage={errorMessage ?? undefined}
        flashMessage={flashMessage}
      />
    );
  } catch (error) {
    return context.render(
      <AssetsPage
        items={[]}
        pagination={{ page: 1, pageSize: 20, total: 0, totalPages: 0 }}
        filters={{}}
        errorMessage={
          error instanceof Error ? error.message : "Failed to load assets."
        }
      />
    );
  }
});
