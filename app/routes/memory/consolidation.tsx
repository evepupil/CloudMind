import { createRoute } from "honox/factory";

import { ConsolidationPage } from "@/features/memory/components/consolidation-page";
import { getConsolidationView } from "@/features/memory/server/memory-browse-service";

// 整合页：取漂移边 + 重复陈述 + 计数（实时待办快照）。
export default createRoute(async (context) => {
  const view = await getConsolidationView(context.env);
  return context.render(<ConsolidationPage view={view} />);
});
