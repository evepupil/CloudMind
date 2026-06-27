import { createRoute } from "honox/factory";

import { ActivityPage } from "@/features/activity/components/activity-page";
import { getActivitySnapshot } from "@/features/activity/server/activity-service";

// 活动/任务页：取失败 + 处理中资产快照（按 status 过滤），失败可一键重试。
export default createRoute(async (context) => {
  const snapshot = await getActivitySnapshot(context.env);
  return context.render(<ActivityPage snapshot={snapshot} />);
});
