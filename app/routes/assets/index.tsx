import { createRoute } from "honox/factory";

import { AssetsPage } from "@/features/assets/components/assets-page";
import { listAssets } from "@/features/assets/server/service";

// 这里让列表页直接走 service 层，页面不拼装底层存储逻辑。
export default createRoute(async (context) => {
  try {
    const items = await listAssets(context.env);
    const errorMessage = context.req.query("error");
    const flashMessage = context.req.query("created");

    return context.render(
      <AssetsPage
        items={items}
        errorMessage={errorMessage ?? undefined}
        flashMessage={flashMessage ?? undefined}
      />
    );
  } catch (error) {
    return context.render(
      <AssetsPage
        items={[]}
        errorMessage={
          error instanceof Error ? error.message : "Failed to load assets."
        }
      />
    );
  }
});
