import type { AssetDomain } from "@/features/assets/model/types";

export const contextProfileValues = [
  "general",
  "coding",
  "writing",
  "research",
  "personal_review",
] as const;

export type ContextProfileName = (typeof contextProfileValues)[number];

export interface ContextProfileDefinition {
  name: ContextProfileName;
  description: string;
  boostedDomains: AssetDomain[];
  suppressedDomains: AssetDomain[];
  includeSummaryOnly: boolean;
  overfetchMultiplier: number;
}

export interface ContextRetrievalPolicy {
  profile: ContextProfileName;
  boostedDomains: AssetDomain[];
  suppressedDomains: AssetDomain[];
  includeSummaryOnly: boolean;
  overfetchMultiplier: number;
}

// 这里先把 profile 固定在代码配置里，后续再结合 MCP 鉴权做云端可配置。
export const contextProfiles: Record<
  ContextProfileName,
  ContextProfileDefinition
> = {
  general: {
    name: "general",
    description:
      "Balanced retrieval across all knowledge domains without strong bias.",
    boostedDomains: [],
    suppressedDomains: [],
    includeSummaryOnly: true,
    overfetchMultiplier: 2,
  },
  coding: {
    name: "coding",
    description:
      "Prioritize engineering knowledge for coding, debugging, and system design work.",
    boostedDomains: ["engineering", "research"],
    suppressedDomains: ["personal", "finance", "health"],
    includeSummaryOnly: true,
    overfetchMultiplier: 3,
  },
  writing: {
    name: "writing",
    description:
      "Prioritize product, research, and general notes for drafting and synthesis tasks.",
    boostedDomains: ["product", "research", "general"],
    suppressedDomains: ["health", "finance"],
    includeSummaryOnly: true,
    overfetchMultiplier: 2,
  },
  research: {
    name: "research",
    description:
      "Prioritize research-heavy assets while still considering engineering references.",
    boostedDomains: ["research", "engineering"],
    suppressedDomains: ["personal", "finance"],
    includeSummaryOnly: true,
    overfetchMultiplier: 3,
  },
  personal_review: {
    name: "personal_review",
    description:
      "Prioritize personal records and adjacent notes for private review workflows.",
    boostedDomains: ["personal", "general"],
    suppressedDomains: ["finance", "health"],
    includeSummaryOnly: true,
    overfetchMultiplier: 2,
  },
};

export const resolveContextRetrievalPolicy = (
  profile: ContextProfileName | undefined
): ContextRetrievalPolicy => {
  const resolvedProfile = profile ?? "general";
  const definition = contextProfiles[resolvedProfile];

  return {
    profile: definition.name,
    boostedDomains: [...definition.boostedDomains],
    suppressedDomains: [...definition.suppressedDomains],
    includeSummaryOnly: definition.includeSummaryOnly,
    overfetchMultiplier: definition.overfetchMultiplier,
  };
};

export const getContextProfileSummary = (
  policy: ContextRetrievalPolicy
): {
  profile: ContextProfileName;
  boostedDomains: AssetDomain[];
  suppressedDomains: AssetDomain[];
  includeSummaryOnly: boolean;
} => {
  return {
    profile: policy.profile,
    boostedDomains: [...policy.boostedDomains],
    suppressedDomains: [...policy.suppressedDomains],
    includeSummaryOnly: policy.includeSummaryOnly,
  };
};

export const getContextProfileDescriptions = (): Array<{
  name: ContextProfileName;
  description: string;
}> => {
  return contextProfileValues.map((name) => ({
    name,
    description: contextProfiles[name].description,
  }));
};
