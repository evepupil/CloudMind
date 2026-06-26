import { createRoute } from "honox/factory";

import { TimelinePage } from "@/features/memory/components/timeline-page";
import { getTimelineView } from "@/features/memory/server/memory-browse-service";

// 事实/时间线页：取陈述（含失效）+ 实体名映射 + 计数。
export default createRoute(async (context) => {
  const view = await getTimelineView(context.env);
  return context.render(<TimelinePage view={view} />);
});
