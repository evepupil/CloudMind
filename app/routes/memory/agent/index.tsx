import { createRoute } from "honox/factory";

import { AgentMemoryPage } from "@/features/memory/components/agent-memory-page";
import { memoryManagementQuerySchema } from "@/features/memory/server/management-schemas";
import { listManagedRecords } from "@/features/memory/server/management-service";

const getFlashMessage = (query: Record<string, string | undefined>) => {
  if (query.forgotten) {
    return "记忆已遗忘，相关 chunk 向量已进入清理流程。";
  }
  if (query.restored) {
    return "记忆已恢复，索引重建已开始。";
  }
  if (query.updated) {
    return "新版本已创建，处理完成后会自动替换当前版本。";
  }

  return undefined;
};

export default createRoute(async (context) => {
  const parsed = memoryManagementQuerySchema.safeParse(context.req.queries());
  const query = parsed.success ? parsed.data : {};
  const validationError = parsed.success
    ? undefined
    : "筛选参数无效，已恢复默认视图。";

  try {
    const view = await listManagedRecords(context.env, query);

    return context.render(
      <AgentMemoryPage
        view={view}
        errorMessage={context.req.query("error") ?? validationError}
        flashMessage={getFlashMessage(context.req.query())}
      />
    );
  } catch (error) {
    return context.render(
      <AgentMemoryPage
        view={{
          items: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
          contexts: [],
          filters: {
            recordKinds: ["memory"],
            scopeIds: ["agent"],
            deleted: "exclude",
            page: 1,
            pageSize: 20,
          },
        }}
        errorMessage={
          error instanceof Error ? error.message : "加载记忆控制台失败。"
        }
      />
    );
  }
});
