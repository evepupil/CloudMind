import { createRoute } from "honox/factory";

import { AssetNotFoundError } from "@/core/assets/errors";
import { AgentMemoryDetailPage } from "@/features/memory/components/agent-memory-detail-page";
import { getManagedMemory } from "@/features/memory/server/management-service";

const getFlashMessage = (query: Record<string, string | undefined>) => {
  if (query.updated) {
    return "新版本已创建，处理完成后会自动替换当前版本。";
  }
  if (query.forgotten) {
    return "记忆已遗忘，原始快照仍可用于恢复。";
  }
  if (query.restored) {
    return "记忆已恢复，索引重建已开始。";
  }

  return undefined;
};

export default createRoute(async (context) => {
  const id = context.req.param("id");
  const errorMessage = context.req.query("error") ?? undefined;

  if (!id) {
    context.status(404);
    return context.render(
      <AgentMemoryDetailPage errorMessage="未找到该记忆。" />
    );
  }

  try {
    const view = await getManagedMemory(context.env, id);

    return context.render(
      <AgentMemoryDetailPage
        view={view}
        errorMessage={errorMessage}
        flashMessage={getFlashMessage(context.req.query())}
      />
    );
  } catch (error) {
    context.status(error instanceof AssetNotFoundError ? 404 : 500);

    return context.render(
      <AgentMemoryDetailPage
        errorMessage={
          errorMessage ??
          (error instanceof Error ? error.message : "加载记忆详情失败。")
        }
      />
    );
  }
});
