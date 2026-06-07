import type { EvidenceItem } from "@/features/search/model/evidence";

import type { ChatSource } from "../model/types";

export type GroundingContext = EvidenceItem;

export const CHAT_ALLOWED_AI_VISIBILITY = ["allow"] as const;
export const CHAT_SUMMARY_ONLY_AI_VISIBILITY = ["summary_only"] as const;
export const SOURCE_TYPE_PRIORITY: Record<ChatSource["sourceType"], number> = {
  chunk: 2,
  // 图检索事实层：chat 自身检索暂不产出 statement 证据，此处仅为类型完备（与 EvidenceLayer 对齐）。
  statement: 2,
  summary: 1,
};
