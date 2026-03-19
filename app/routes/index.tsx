import { createRoute } from "honox/factory";

import { HomePage } from "@/features/home/components/home-page";

// 这里让首页 route 保持很薄，只负责渲染首页 feature。
export default createRoute((context) => {
  return context.render(<HomePage />);
});
