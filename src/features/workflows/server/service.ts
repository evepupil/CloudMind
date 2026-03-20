import type { WorkflowRepository } from "@/core/workflows/ports";
import type { AppBindings } from "@/env";
import type {
  WorkflowRunDetail,
  WorkflowRunRecord,
} from "@/features/workflows/model/types";
import { getWorkflowRepositoryFromBindings } from "@/platform/db/d1/repositories/get-workflow-repository";

interface WorkflowServiceDependencies {
  getWorkflowRepository: (
    bindings: AppBindings | undefined
  ) => WorkflowRepository | Promise<WorkflowRepository>;
}

const defaultDependencies: WorkflowServiceDependencies = {
  getWorkflowRepository: getWorkflowRepositoryFromBindings,
};

// 这里收口 workflow 查询用例，供 API 和页面复用。
export const createWorkflowService = (
  dependencies: WorkflowServiceDependencies = defaultDependencies
) => {
  return {
    async listWorkflowRunsByAssetId(
      bindings: AppBindings | undefined,
      assetId: string
    ): Promise<WorkflowRunRecord[]> {
      const repository = await dependencies.getWorkflowRepository(bindings);

      return repository.listWorkflowRunsByAssetId(assetId);
    },

    async getWorkflowRunDetail(
      bindings: AppBindings | undefined,
      runId: string
    ): Promise<WorkflowRunDetail> {
      const repository = await dependencies.getWorkflowRepository(bindings);

      return repository.getWorkflowRunDetail(runId);
    },
  };
};

const workflowService = createWorkflowService();

export const { listWorkflowRunsByAssetId, getWorkflowRunDetail } =
  workflowService;
