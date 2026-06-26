import { createRoute } from "honox/factory";

import { ComingSoonPage } from "@/features/layout/components/coming-soon-page";

// 记忆图谱页占位（Phase 5 接 GET /api/memory/* + dagre SSR-SVG）。
export default createRoute((context) => {
  return context.render(
    <ComingSoonPage
      navigationKey="graph"
      eyebrow="记忆层 · 图谱"
      title="记忆图谱"
      phase="Phase 5"
      description="实体、陈述与关系边构成的知识图谱，可视化你的记忆如何相互连接。"
    />
  );
});
