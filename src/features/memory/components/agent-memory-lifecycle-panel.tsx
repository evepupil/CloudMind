import type { ManagedMemoryDetailView } from "@/features/memory/server/management-service";
import { buttonClass, Panel } from "@/features/ui/components";
import { agentMemoryInputClass } from "./agent-memory-view";

const TargetFields = ({
  scopeId,
  contextKey,
}: {
  scopeId: string;
  contextKey: string;
}) => (
  <>
    <input type="hidden" name="scopeId" value={scopeId} />
    <input type="hidden" name="contextKey" value={contextKey} />
  </>
);

export const AgentMemoryLifecyclePanel = ({
  view,
}: {
  view: ManagedMemoryDetailView;
}) => {
  const { item, versions } = view;
  const hasSuccessor = versions.some(
    (version) =>
      version.previousVersionId === item.id &&
      !version.deletedAt &&
      !version.supersededAt
  );
  const isCurrent = !item.deletedAt && !item.supersededAt;
  const canUpdate = isCurrent && item.status === "ready" && !hasSuccessor;
  const canForget = canUpdate;
  const canRestore = Boolean(item.deletedAt) && !item.supersededAt;

  return (
    <Panel class="p-5" variant="panel">
      <h2 class="mb-3 font-display text-[17px] font-semibold text-bone">
        生命周期
      </h2>
      {canUpdate ? (
        <form
          action={`/memory/agent/actions/${item.id}/update`}
          method="post"
          class="grid gap-3"
        >
          <TargetFields scopeId={item.scopeId} contextKey={item.contextKey} />
          <label class="grid gap-1.5">
            <span class="text-[12px] font-medium text-bone-soft">
              新版本标题
            </span>
            <input
              name="title"
              value={item.title}
              required
              maxlength={300}
              class={agentMemoryInputClass}
            />
          </label>
          <label class="grid gap-1.5">
            <span class="text-[12px] font-medium text-bone-soft">
              新版本内容
            </span>
            <textarea
              name="content"
              required
              maxlength={20000}
              rows={10}
              class={`${agentMemoryInputClass} resize-y leading-[1.7]`}
            >
              {item.contentText ?? ""}
            </textarea>
          </label>
          <button type="submit" class={buttonClass("primary")}>
            创建新版本
          </button>
        </form>
      ) : (
        <p class="text-[13px] leading-relaxed text-bone-soft">
          {item.deletedAt
            ? "这条记忆已遗忘，可先恢复。"
            : item.supersededAt
              ? "历史版本保持只读，请在当前版本上继续更新。"
              : hasSuccessor
                ? "新版本正在处理，完成前暂不接受重复更新。"
                : "当前状态暂不支持更新。"}
        </p>
      )}

      {canForget ? (
        <form
          action={`/memory/agent/actions/${item.id}/forget`}
          method="post"
          class="mt-4 border-t border-line-soft pt-4"
        >
          <TargetFields scopeId={item.scopeId} contextKey={item.contextKey} />
          <button type="submit" class={`w-full ${buttonClass("danger")}`}>
            遗忘这条记忆
          </button>
          <p class="mt-2 text-[11.5px] leading-relaxed text-bone-faint">
            记忆会软删除并清理 chunk 向量，原始快照保留，可恢复。
          </p>
        </form>
      ) : null}

      {canRestore ? (
        <form
          action={`/memory/agent/actions/${item.id}/restore`}
          method="post"
          class="mt-4 border-t border-line-soft pt-4"
        >
          <TargetFields scopeId={item.scopeId} contextKey={item.contextKey} />
          <button type="submit" class={`w-full ${buttonClass("primary")}`}>
            恢复并重建索引
          </button>
        </form>
      ) : null}
    </Panel>
  );
};
