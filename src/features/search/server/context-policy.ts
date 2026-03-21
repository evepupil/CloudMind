import type { AssetDomain, AssetSummary } from "@/features/assets/model/types";
import type { ContextRetrievalPolicy } from "@/features/mcp/server/context-profiles";

const DOMAIN_BOOST = 0.12;
const DOMAIN_SUPPRESSION = -0.1;
const PRIORITY_WEIGHT = 0.0015;

const buildDomainWeightMap = (
  policy: ContextRetrievalPolicy
): Map<AssetDomain, number> => {
  const weights = new Map<AssetDomain, number>();

  for (const domain of policy.boostedDomains) {
    weights.set(domain, DOMAIN_BOOST);
  }

  for (const domain of policy.suppressedDomains) {
    weights.set(domain, DOMAIN_SUPPRESSION);
  }

  return weights;
};

export const applyContextPolicyScore = (
  baseScore: number,
  asset: AssetSummary,
  policy: ContextRetrievalPolicy | undefined
): number => {
  if (!policy) {
    return baseScore;
  }

  const weights = buildDomainWeightMap(policy);
  const domainWeight = weights.get(asset.domain) ?? 0;
  const priorityWeight = asset.retrievalPriority * PRIORITY_WEIGHT;

  return baseScore + domainWeight + priorityWeight;
};

export const matchesContextPolicyAsset = (
  asset: AssetSummary,
  policy: ContextRetrievalPolicy | undefined
): boolean => {
  if (!policy) {
    return true;
  }

  if (policy.allowFallback) {
    return true;
  }

  if (policy.preferredDomains.length === 0) {
    return true;
  }

  return policy.preferredDomains.includes(asset.domain);
};
