import type { EvidenceItem } from "@/features/search/model/evidence";

import type { ChatSource } from "../model/types";

export type GroundingContext = EvidenceItem;

export const CHAT_ALLOWED_AI_VISIBILITY = ["allow"] as const;
export const CHAT_SUMMARY_ONLY_AI_VISIBILITY = ["summary_only"] as const;
export const SOURCE_TYPE_PRIORITY: Record<ChatSource["sourceType"], number> = {
  chunk: 2,
  summary: 1,
};
