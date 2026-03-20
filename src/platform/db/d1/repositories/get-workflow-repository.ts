import type { WorkflowRepository } from "@/core/workflows/ports";
import type { AppBindings } from "@/env";

import { D1WorkflowRepository } from "./d1-workflow-repository";

const getDatabaseBinding = (bindings: AppBindings | undefined): D1Database => {
  if (!bindings?.DB) {
    throw new Error(
      'Cloudflare D1 binding "DB" is not configured. ' +
        "Create the database and bind it in wrangler.jsonc before using workflows."
    );
  }

  return bindings.DB;
};

// 这里集中解析 workflow repository，避免业务层直接 new D1 实现。
export const getWorkflowRepositoryFromBindings = (
  bindings: AppBindings | undefined
): WorkflowRepository => {
  return new D1WorkflowRepository(getDatabaseBinding(bindings));
};
