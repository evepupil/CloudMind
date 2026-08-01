import { createRoute } from "honox/factory";

import { GraphPage } from "@/features/memory/components/graph-page";
import { memoryBrowseQuerySchema } from "@/features/memory/server/management-schemas";
import { getGraphView } from "@/features/memory/server/memory-browse-service";

// 记忆图谱页：取实体 + 活跃边 + 计数，SSR 出环形布局 SVG。
export default createRoute(async (context) => {
  const parsed = memoryBrowseQuerySchema.safeParse(context.req.queries());
  const view = await getGraphView(
    context.env,
    80,
    parsed.success ? parsed.data.contextKey : undefined
  );
  return context.render(<GraphPage view={view} />);
});
