import type { AssetDetail } from "@/features/assets/model/types";
import { Panel } from "@/features/ui/components";
import { formatMemoryDate } from "./agent-memory-view";

export const AgentMemoryMetadataPanels = ({ item }: { item: AssetDetail }) => (
  <>
    <Panel class="p-5" variant="panel">
      <h2 class="mb-3 font-display text-[17px] font-semibold text-bone">
        来源
      </h2>
      <dl class="grid gap-3 text-[13px]">
        <div>
          <dt class="font-mono text-[10.5px] uppercase text-bone-faint">
            写入入口
          </dt>
          <dd class="mt-1 text-bone">
            {item.source?.kind ?? item.sourceKind ?? "N/A"}
          </dd>
        </div>
        <div>
          <dt class="font-mono text-[10.5px] uppercase text-bone-faint">
            原始快照
          </dt>
          <dd class="mt-1 break-words font-mono text-[11.5px] text-bone-soft">
            {item.rawR2Key ?? "N/A"}
          </dd>
        </div>
        <div>
          <dt class="font-mono text-[10.5px] uppercase text-bone-faint">
            记忆根
          </dt>
          <dd class="mt-1 break-words font-mono text-[11.5px] text-bone-soft">
            {item.memoryRootId ?? item.id}
          </dd>
        </div>
      </dl>
    </Panel>

    <Panel class="p-5" variant="panel">
      <h2 class="mb-3 font-display text-[17px] font-semibold text-bone">
        处理状态
      </h2>
      <dl class="grid gap-2 text-[13px] text-bone-soft">
        <div>创建：{formatMemoryDate(item.createdAt)}</div>
        <div>更新：{formatMemoryDate(item.updatedAt)}</div>
        <div>处理完成：{formatMemoryDate(item.processedAt)}</div>
        <div>切块：{item.chunks.length}</div>
        <div>AI 可见性：{item.aiVisibility}</div>
      </dl>
    </Panel>
  </>
);
