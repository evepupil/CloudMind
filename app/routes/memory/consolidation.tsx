import { createRoute } from "honox/factory";

import { ComingSoonPage } from "@/features/layout/components/coming-soon-page";

// 整合页占位（Phase 5 接 findDriftedEdges + findDuplicateActiveStatements）。
export default createRoute((context) => {
  return context.render(
    <ComingSoonPage
      navigationKey="consolidation"
      eyebrow="记忆层 · 整合"
      title="整合"
      phase="Phase 5"
      description="sleep-time 整合的可观测面：漂移边、重复陈述、遗忘与归档状态。"
    />
  );
});
