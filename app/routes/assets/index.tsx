import { createRoute } from "honox/factory";

import { AssetsPage } from "@/features/assets/components/assets-page";
import { assetListQuerySchema } from "@/features/assets/server/schemas";
import { listAssets } from "@/features/assets/server/service";

// 这里让列表页直接走 service 层，页面不拼装底层存储逻辑。
export default createRoute(async (context) => {
  try {
    const parsedQuery = assetListQuerySchema.safeParse(context.req.query());
    const filters = parsedQuery.success ? parsedQuery.data : {};
    const result = await listAssets(context.env, filters);
    const errorMessage = context.req.query("error");
    const flashMessage = context.req.query("created");

    return context.render(
      <AssetsPage
        items={result.items}
        pagination={result.pagination}
        filters={filters}
        errorMessage={errorMessage ?? undefined}
        flashMessage={flashMessage ?? undefined}
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
