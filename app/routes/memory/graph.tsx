import { createRoute } from "honox/factory";

import { GraphPage } from "@/features/memory/components/graph-page";
import { getGraphView } from "@/features/memory/server/memory-browse-service";

// 记忆图谱页：取实体 + 活跃边 + 计数，SSR 出环形布局 SVG。
export default createRoute(async (context) => {
  const view = await getGraphView(context.env);
  return context.render(<GraphPage view={view} />);
});
