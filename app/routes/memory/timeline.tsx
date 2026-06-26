import { createRoute } from "honox/factory";

import { ComingSoonPage } from "@/features/layout/components/coming-soon-page";

// 事实/时间线页占位（Phase 5 接 listStatements + bi-temporal 有效期）。
export default createRoute((context) => {
  return context.render(
    <ComingSoonPage
      navigationKey="timeline"
      eyebrow="记忆层 · 事实"
      title="事实 / 时间线"
      phase="Phase 5"
      description="带双时间有效期的陈述，按时间轴铺开，可追溯每条事实的生效与失效。"
    />
  );
});
