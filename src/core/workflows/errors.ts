// 这里放 workflow 领域错误，避免路由层依赖仓储实现细节。
export class WorkflowRunNotFoundError extends Error {
  public constructor(id: string) {
    super(`Workflow run "${id}" was not found.`);
    this.name = "WorkflowRunNotFoundError";
  }
}
