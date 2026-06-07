import { z } from "zod";

import type { AIProvider } from "@/core/ai/ports";
import { createLogger } from "@/core/logging/logger";
import type { MemoryStatement } from "@/core/memory/ports";

import {
  type ExtractedStatement,
  extractFirstJsonObject,
  stripReasoning,
} from "./graph-extraction";

const logger = createLogger("memory_reconcile");

// 智能写调和动作（对标 mem0）：
//   ADD    — 新事实，不与任何已知事实矛盾，落库。
//   UPDATE — 新事实是同一属性的更新版（如换城市/换职位），旧事实置失效并 superseded_by 指向新。
//   DELETE — 新事实与旧事实矛盾/否定，旧事实置失效；不另存新陈述（历史靠 expired_at 保留）。
//   NOOP   — 新事实已被某条旧事实表达（重复），不落库。
export type ReconcileAction = "ADD" | "UPDATE" | "DELETE" | "NOOP";

export interface ReconcileDecision {
  action: ReconcileAction;
  // UPDATE/DELETE 时指向被取代/失效的旧陈述 id；ADD/NOOP 为 null。
  targetStatementId: string | null;
}

export interface ReconcileInput {
  statement: ExtractedStatement;
  candidates: MemoryStatement[];
}

// 注入式调和裁决器：生产环境由 LLM 实现，测试可注入 fake。
export type ReconcileJudge = (
  input: ReconcileInput
) => Promise<ReconcileDecision>;

const ADD_DECISION: ReconcileDecision = {
  action: "ADD",
  targetStatementId: null,
};

const reconcileSchema = z.object({
  action: z.string().trim().min(1),
  // 1-based 候选下标；ADD/NOOP 可为 null/缺省。
  target: z.number().int().positive().nullable().optional(),
});

// 解析 LLM 调和响应：剥 think → 取首个平衡 JSON → 校验 action 与 target 下标。
// 任何不合法一律返回 null（调用方兜底为 ADD），绝不误失效旧记忆。
export const parseReconcileDecision = (
  text: string,
  candidates: MemoryStatement[]
): ReconcileDecision | null => {
  const jsonText = extractFirstJsonObject(stripReasoning(text));

  if (!jsonText) {
    return null;
  }

  let raw: unknown;

  try {
    raw = JSON.parse(jsonText);
  } catch {
    return null;
  }

  const parsed = reconcileSchema.safeParse(raw);

  if (!parsed.success) {
    return null;
  }

  const action = parsed.data.action.toUpperCase();

  if (action === "ADD") {
    return ADD_DECISION;
  }

  if (action === "NOOP") {
    return { action: "NOOP", targetStatementId: null };
  }

  if (action !== "UPDATE" && action !== "DELETE") {
    return null;
  }

  // UPDATE / DELETE 必须有合法的候选下标，否则视为非法（兜底 ADD）。
  const target = parsed.data.target;

  if (typeof target !== "number") {
    return null;
  }

  const candidate = candidates[target - 1];

  if (!candidate) {
    return null;
  }

  return { action, targetStatementId: candidate.id };
};

const SYSTEM_PROMPT = [
  "You reconcile a NEW fact against EXISTING facts about the same subject in a personal memory layer.",
  'Return ONLY a JSON object, no prose: {"action":"ADD|UPDATE|DELETE|NOOP","target":<1-based index of an existing fact, or null>}',
  "Rules:",
  "- NOOP: the new fact is already represented by an existing fact (duplicate, no new info). target=null.",
  "- ADD: the new fact is new information that does not contradict any existing fact. target=null.",
  "- UPDATE: the new fact is a newer value of the SAME attribute as an existing fact (e.g. moved city, changed role/title). target=that fact's index.",
  "- DELETE: the new fact contradicts or negates an existing fact so it is no longer true. target=that fact's index.",
  "- Use UPDATE/DELETE ONLY with a clear single target; when unsure, prefer ADD.",
].join("\n");

// 构造 LLM 调和裁决器。无候选时直接 ADD（不浪费一次调用）；LLM 失败/不合法兜底 ADD。
export const createReconcileJudge = (
  aiProvider: AIProvider
): ReconcileJudge => {
  return async ({ statement, candidates }) => {
    if (candidates.length === 0) {
      return ADD_DECISION;
    }

    const list = candidates
      .map((candidate, index) => `${index + 1}. ${candidate.nlText}`)
      .join("\n");

    let result: { text: string };

    try {
      result = await aiProvider.generateText({
        systemPrompt: SYSTEM_PROMPT,
        prompt: `NEW FACT:\n${statement.nlText}\n\nEXISTING FACTS about the same subject:\n${list}\n\nRespond with a single JSON object and nothing else. /no_think`,
        temperature: 0.1,
        maxOutputTokens: 200,
      });
    } catch (error) {
      logger.warn("reconcile_failed", {}, { error });

      return ADD_DECISION;
    }

    const decision = parseReconcileDecision(result.text, candidates);

    if (!decision) {
      logger.warn("reconcile_invalid", {});

      return ADD_DECISION;
    }

    return decision;
  };
};
