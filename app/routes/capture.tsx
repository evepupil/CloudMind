import { createRoute } from "honox/factory";

import { CapturePage } from "@/features/capture/components/capture-page";

const getMode = (value: string | undefined): "url" | "text" | "pdf" => {
  if (value === "url" || value === "pdf") {
    return value;
  }

  return "text";
};

// 这里提供统一 Capture 页面入口，先让侧边栏导航完整可用。
export default createRoute((context) => {
  const mode = getMode(context.req.query("mode") ?? undefined);

  return context.render(<CapturePage mode={mode} />);
});
