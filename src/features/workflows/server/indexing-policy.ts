import type { CreateAssetAssertionInput } from "@/core/assets/ports";
import type { AssetAssertionKind } from "@/features/assets/model/types";
import {
  type AccessPolicyResult,
  ASSERTION_CONSTRAINT_KEYWORDS,
  ASSERTION_DECISION_KEYWORDS,
  type AssetAccessPolicy,
  type AssetDescriptor,
  type DeriveIndexingContext,
  type DescriptorResult,
} from "./policies/types-and-helpers";

export { deriveAccessPolicy } from "./policies/access-policy";

export { deriveDescriptor } from "./policies/domain-classifier";
export {
  deriveFacets,
  deriveSemanticFacets,
  deriveSystemFacets,
} from "./policies/facet-deriver";
export type {
  AccessPolicyResult,
  AssetAccessPolicy,
  AssetDescriptor,
  DeriveIndexingContext,
  DescriptorResult,
};

const splitIntoStatements = (content: string): string[] => {
  return content
    .split(/(?<=[.!?。！？；;])\s+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 24 && item.length <= 220);
};

const classifyAssertionKind = (text: string): AssetAssertionKind => {
  const normalized = text.toLowerCase();

  if (
    ASSERTION_CONSTRAINT_KEYWORDS.some((keyword) =>
      normalized.includes(keyword)
    )
  ) {
    return "constraint";
  }

  if (
    ASSERTION_DECISION_KEYWORDS.some((keyword) => normalized.includes(keyword))
  ) {
    return "decision";
  }

  return "fact";
};

export const deriveAssertions = (
  context: DeriveIndexingContext
): CreateAssetAssertionInput[] => {
  const candidates: Array<{
    kind: AssetAssertionKind;
    text: string;
    confidence: number;
  }> = [];
  const summary = context.summary?.trim();
  const content = context.normalizedContent?.trim();

  if (summary) {
    candidates.push({
      kind: "summary_point",
      text: summary,
      confidence: 0.92,
    });
  }

  for (const statement of splitIntoStatements(content ?? "")) {
    candidates.push({
      kind: classifyAssertionKind(statement),
      text: statement,
      confidence: 0.78,
    });
  }

  const deduped = new Set<string>();

  return candidates
    .filter((candidate) => {
      const key = candidate.text.toLowerCase();

      if (deduped.has(key)) {
        return false;
      }

      deduped.add(key);

      return true;
    })
    .slice(0, 5)
    .map((candidate, index) => ({
      assertionIndex: index,
      kind: candidate.kind,
      text: candidate.text,
      sourceChunkIndex: null,
      sourceSpanJson: null,
      confidence: candidate.confidence,
    }));
};
