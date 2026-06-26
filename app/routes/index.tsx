import { createRoute } from "honox/factory";

import { HomePage } from "@/features/home/components/home-page";
import { getOverviewSnapshot } from "@/features/home/server/overview-service";

// 首页 route：取 Overview 真实快照（资产状态计数 + 最近采集）后渲染。
export default createRoute(async (context) => {
  const snapshot = await getOverviewSnapshot(context.env);
  return context.render(<HomePage snapshot={snapshot} />);
});
