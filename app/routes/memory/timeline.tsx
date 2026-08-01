import { createRoute } from "honox/factory";

import { TimelinePage } from "@/features/memory/components/timeline-page";
import { memoryBrowseQuerySchema } from "@/features/memory/server/management-schemas";
import { getTimelineView } from "@/features/memory/server/memory-browse-service";

// 事实/时间线页：取陈述（含失效）+ 实体名映射 + 计数。
export default createRoute(async (context) => {
  const parsed = memoryBrowseQuerySchema.safeParse(context.req.queries());
  const view = await getTimelineView(
    context.env,
    100,
    parsed.success ? parsed.data.contextKey : undefined
  );
  return context.render(<TimelinePage view={view} />);
});
