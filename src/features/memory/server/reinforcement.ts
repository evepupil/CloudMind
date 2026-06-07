import { z } from "zod";

import type { MemoryRepository } from "@/core/memory/ports";
import type { JobQueueMessage } from "@/core/queue/ports";

// 图检索命中强化的队列消息类型：把「被检索命中的 statement 访问写回」从请求路径解耦到消费端。
export const REINFORCE_GRAPH_ACCESS_TYPE = "reinforce_graph_access";

const payloadSchema = z.object({
  statementIds: z.array(z.string().trim().min(1)).min(1).max(100),
});

export interface ReinforceGraphAccessPayload {
  statementIds: string[];
}

export const buildReinforceGraphAccessMessage = (
  statementIds: string[]
): JobQueueMessage => ({
  type: REINFORCE_GRAPH_ACCESS_TYPE,
  payloadJson: JSON.stringify({ statementIds }),
});

// 解析强化消息；类型不符或负载不合法一律返回 null（消费端再交回 workflow 分支处理）。
export const parseReinforceGraphAccessMessage = (
  message: JobQueueMessage
): ReinforceGraphAccessPayload | null => {
  if (message.type !== REINFORCE_GRAPH_ACCESS_TYPE) {
    return null;
  }

  let raw: unknown;

  try {
    raw = JSON.parse(message.payloadJson);
  } catch {
    return null;
  }

  const parsed = payloadSchema.safeParse(raw);

  if (!parsed.success) {
    return null;
  }

  return { statementIds: parsed.data.statementIds };
};

export const applyGraphAccessReinforcement = async (
  memoryRepository: Pick<MemoryRepository, "bumpStatementAccess">,
  payload: ReinforceGraphAccessPayload
): Promise<void> => {
  await memoryRepository.bumpStatementAccess(payload.statementIds);
};
