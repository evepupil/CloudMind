import { buttonClass } from "@/features/ui/components";

// 详情/工作流页头操作：返回记忆库 + 基于此条问答。
export const AssetPageActions = ({
  assetId,
}: {
  assetId?: string | undefined;
}) => {
  void assetId;

  return (
    <>
      <a class={buttonClass("subtle")} href="/assets">
        ← 记忆库
      </a>
      <a class={buttonClass("primary")} href="/ask">
        ? 问答
      </a>
    </>
  );
};
