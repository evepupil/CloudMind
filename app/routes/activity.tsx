import { createRoute } from "honox/factory";

import { ComingSoonPage } from "@/features/layout/components/coming-soon-page";

// 活动/任务页占位（Phase 6 接处理中/失败任务集中视图）。
export default createRoute((context) => {
  return context.render(
    <ComingSoonPage
      navigationKey="activity"
      eyebrow="系统 · 活动"
      title="活动 / 任务"
      phase="Phase 6"
      description="处理中与失败任务的集中视图，提供重试、查看失败原因与跳转资产入口。"
    />
  );
});
