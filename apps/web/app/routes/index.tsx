import { createRoute } from "honox/factory";

import { HomePage } from "@/features/home/components/home-page";

// 这里让首页 route 保持很薄，只负责把 feature 组件渲染出来。
export default createRoute((context) => {
  return context.render(<HomePage />);
});
