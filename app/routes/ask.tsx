import { createRoute } from "honox/factory";

import { AskPage } from "@/features/chat/components/ask-page";

// 这里提供 Ask 页原型入口，后续接入真实问答链路时直接扩展这一页。
export default createRoute((context) => {
  return context.render(<AskPage />);
});
