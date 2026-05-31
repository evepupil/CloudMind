import type {
  AssetAiVisibility,
  AssetDetail,
  AssetDomain,
  AssetSensitivity,
} from "@/features/assets/model/types";
import type { DeriveIndexingContext } from "./types-and-helpers";
import {
  type AccessPolicyResult,
  type AssetAccessPolicy,
  type AssetDescriptor,
  collectCorpus,
  getSourceKind,
  hasKeyword,
  PRIVATE_KEYWORDS,
  PUBLIC_HOST_HINTS,
  RESTRICTED_KEYWORDS,
} from "./types-and-helpers";

const deriveSensitivity = (
  asset: AssetDetail,
  domain: AssetDomain,
  corpus: string,
  sourceHost: string | null
): { sensitivity: AssetSensitivity; reasons: string[] } => {
  const reasons: string[] = [];

  if (hasKeyword(corpus, RESTRICTED_KEYWORDS)) {
    reasons.push("restricted_keyword");

    return { sensitivity: "restricted", reasons };
  }

  if (hasKeyword(corpus, PRIVATE_KEYWORDS)) {
    reasons.push("private_keyword");

    return { sensitivity: "private", reasons };
  }

  if (domain === "personal" || domain === "finance" || domain === "health") {
    reasons.push(`domain:${domain}`);

    return { sensitivity: "private", reasons };
  }

  if (
    sourceHost &&
    PUBLIC_HOST_HINTS.some(
      (hint) => sourceHost === hint || sourceHost.includes(hint)
    )
  ) {
    reasons.push("public_host");

    return { sensitivity: "public", reasons };
  }

  if (asset.type === "url" && sourceHost) {
    reasons.push("web_url_default");

    return { sensitivity: "public", reasons };
  }

  reasons.push("default_internal");

  return { sensitivity: "internal", reasons };
};

const deriveAiVisibility = (
  sensitivity: AssetSensitivity
): AssetAiVisibility => {
  if (sensitivity === "restricted") {
    return "deny";
  }

  if (sensitivity === "private") {
    return "summary_only";
  }

  return "allow";
};

const deriveRetrievalPriority = (
  asset: AssetDetail,
  domain: AssetDomain,
  sensitivity: AssetSensitivity,
  sourceHost: string | null
): number => {
  const sourceKind = getSourceKind(asset);
  let priority = 0;

  if (domain === "engineering") {
    priority += 40;
  }

  if (domain === "product" || domain === "research") {
    priority += 25;
  }

  if (asset.type === "note") {
    priority += 10;
  }

  if (asset.type === "pdf") {
    priority += 5;
  }

  if (sourceKind === "mcp") {
    priority += 10;
  }

  if (sourceHost?.includes("developers.cloudflare.com")) {
    priority += 10;
  }

  if (sensitivity === "private") {
    priority -= 15;
  }

  if (sensitivity === "restricted") {
    priority -= 40;
  }

  return priority;
};

export const deriveAccessPolicy = (
  context: DeriveIndexingContext,
  descriptor: AssetDescriptor
): AccessPolicyResult => {
  const corpus = collectCorpus(context);
  const { sensitivity, reasons } = deriveSensitivity(
    context.asset,
    descriptor.domain,
    corpus,
    descriptor.sourceHost
  );
  const aiVisibility = deriveAiVisibility(sensitivity);
  const retrievalPriority = deriveRetrievalPriority(
    context.asset,
    descriptor.domain,
    sensitivity,
    descriptor.sourceHost
  );
  const policy: AssetAccessPolicy = {
    version: 1,
    strategy: "heuristic_v1",
    sensitivity,
    aiVisibility,
    retrievalPriority,
    reasons,
  };

  return {
    policy,
    indexing: {
      sensitivity,
      aiVisibility,
      retrievalPriority,
    },
  };
};
