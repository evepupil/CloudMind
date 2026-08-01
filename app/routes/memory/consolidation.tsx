import { createRoute } from "honox/factory";

import { ConsolidationPage } from "@/features/memory/components/consolidation-page";
import { memoryBrowseQuerySchema } from "@/features/memory/server/management-schemas";
import { getConsolidationView } from "@/features/memory/server/memory-browse-service";

// 整合页：取漂移边 + 重复陈述 + 计数（实时待办快照）。
export default createRoute(async (context) => {
  const parsed = memoryBrowseQuerySchema.safeParse(context.req.queries());
  const view = await getConsolidationView(
    context.env,
    parsed.success ? parsed.data.contextKey : undefined
  );
  return context.render(<ConsolidationPage view={view} />);
});
