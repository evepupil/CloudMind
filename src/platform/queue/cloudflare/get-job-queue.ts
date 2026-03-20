import type { JobQueue } from "@/core/queue/ports";
import type { AppBindings } from "@/env";

import { CloudflareJobQueue } from "./cloudflare-job-queue";

// 这里集中解析 Queue 绑定，避免业务层直接读环境变量。
export const getJobQueueFromBindings = (
  bindings: AppBindings | undefined
): JobQueue => {
  if (!bindings?.WORKFLOW_QUEUE) {
    throw new Error(
      "Bind WORKFLOW_QUEUE in wrangler.jsonc before using async workflows."
    );
  }

  return new CloudflareJobQueue(bindings.WORKFLOW_QUEUE as Queue);
};
