import type { UpdateAssetIndexingInput } from "@/core/assets/ports";
import type {
  AssetAiVisibility,
  AssetDetail,
  AssetDomain,
  AssetSensitivity,
} from "@/features/assets/model/types";

interface DeriveIndexingContext {
  asset: AssetDetail;
  normalizedContent?: string | null | undefined;
  summary?: string | null | undefined;
}

export interface AssetDescriptor {
  version: 1;
  strategy: "heuristic_v1";
  assetType: AssetDetail["type"];
  sourceKind: AssetDetail["sourceKind"];
  domain: AssetDomain;
  collectionKey: string | null;
  capturedAt: string | null;
  sourceHost: string | null;
  language: string | null;
  mimeType: string | null;
  signals: string[];
}

export interface AssetAccessPolicy {
  version: 1;
  strategy: "heuristic_v1";
  sensitivity: AssetSensitivity;
  aiVisibility: AssetAiVisibility;
  retrievalPriority: number;
  reasons: string[];
}

interface DescriptorResult {
  descriptor: AssetDescriptor;
  indexing: UpdateAssetIndexingInput;
}

interface AccessPolicyResult {
  policy: AssetAccessPolicy;
  indexing: UpdateAssetIndexingInput;
}

const ENGINEERING_KEYWORDS = [
  "typescript",
  "javascript",
  "react",
  "hono",
  "drizzle",
  "api",
  "sdk",
  "repository",
  "worker",
  "queue",
  "vector",
  "schema",
  "bug",
  "debug",
] as const;

const PRODUCT_KEYWORDS = [
  "prd",
  "roadmap",
  "requirement",
  "user story",
  "feature",
  "product",
  "metric",
  "launch",
] as const;

const RESEARCH_KEYWORDS = [
  "paper",
  "whitepaper",
  "study",
  "research",
  "abstract",
  "doi",
  "journal",
  "arxiv",
] as const;

const PERSONAL_KEYWORDS = [
  "diary",
  "journal",
  "family",
  "travel",
  "birthday",
  "memory",
  "personal",
] as const;

const FINANCE_KEYWORDS = [
  "invoice",
  "receipt",
  "bank",
  "tax",
  "salary",
  "budget",
  "expense",
  "payment",
  "finance",
] as const;

const HEALTH_KEYWORDS = [
  "medical",
  "health",
  "hospital",
  "diagnosis",
  "symptom",
  "prescription",
  "sleep",
  "exercise",
] as const;

const ARCHIVE_KEYWORDS = [
  "archive",
  "backup",
  "snapshot",
  "history",
  "legacy",
  "imported",
  "old version",
];

const RESTRICTED_KEYWORDS = [
  "password",
  "secret",
  "private key",
  "api key",
  "access token",
  "refresh token",
  "seed phrase",
  "mnemonic",
  "ssn",
  "passport",
  "cvv",
];

const PRIVATE_KEYWORDS = [
  "salary",
  "bank account",
  "address",
  "phone",
  "email",
  "resume",
  "diary",
  "journal",
  "diagnosis",
  "invoice",
];

const PUBLIC_HOST_HINTS = [
  "developers.cloudflare.com",
  "docs.",
  "developer.",
  "github.com",
  "arxiv.org",
  "wikipedia.org",
];

const normalizeText = (value: string | null | undefined): string => {
  return value?.trim().toLowerCase() ?? "";
};

const getSourceKind = (asset: AssetDetail): AssetDetail["sourceKind"] => {
  return asset.sourceKind ?? asset.source?.kind ?? null;
};

const collectCorpus = (context: DeriveIndexingContext): string => {
  return [
    context.asset.title,
    context.asset.summary,
    context.summary,
    context.asset.sourceUrl,
    context.normalizedContent,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join("\n")
    .toLowerCase();
};

const hasKeyword = (corpus: string, keywords: readonly string[]): boolean => {
  return keywords.some((keyword) => corpus.includes(keyword));
};

const extractSourceHost = (asset: AssetDetail): string | null => {
  const sourceUrl = asset.sourceUrl?.trim() || asset.source?.sourceUrl?.trim();

  if (!sourceUrl) {
    return null;
  }

  try {
    return new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
};

const deriveCollectionKey = (
  asset: AssetDetail,
  sourceHost: string | null
): string | null => {
  const sourceKind = getSourceKind(asset);

  if (sourceHost) {
    return `site:${sourceHost}`;
  }

  if (asset.type === "pdf") {
    return "library:pdf";
  }

  if (asset.type === "note" && sourceKind === "mcp") {
    return "inbox:mcp";
  }

  if (asset.type === "note") {
    return "inbox:notes";
  }

  return null;
};

const deriveDomain = (
  asset: AssetDetail,
  corpus: string,
  sourceHost: string | null
): { domain: AssetDomain; signals: string[] } => {
  const sourceKind = getSourceKind(asset);
  const signals: string[] = [];

  if (
    hasKeyword(corpus, RESEARCH_KEYWORDS) ||
    sourceHost === "arxiv.org" ||
    sourceHost?.endsWith(".ac.uk") ||
    sourceHost?.endsWith(".edu")
  ) {
    signals.push("research_keyword");

    return {
      domain: "research",
      signals,
    };
  }

  if (
    hasKeyword(corpus, ENGINEERING_KEYWORDS) ||
    sourceHost?.includes("github.com") ||
    sourceHost?.includes("developers.cloudflare.com") ||
    sourceHost?.startsWith("docs.") ||
    sourceHost?.startsWith("developer.")
  ) {
    signals.push("engineering_keyword");

    return {
      domain: "engineering",
      signals,
    };
  }

  if (hasKeyword(corpus, PRODUCT_KEYWORDS)) {
    signals.push("product_keyword");

    return {
      domain: "product",
      signals,
    };
  }

  if (hasKeyword(corpus, FINANCE_KEYWORDS)) {
    signals.push("finance_keyword");

    return {
      domain: "finance",
      signals,
    };
  }

  if (hasKeyword(corpus, HEALTH_KEYWORDS)) {
    signals.push("health_keyword");

    return {
      domain: "health",
      signals,
    };
  }

  if (hasKeyword(corpus, PERSONAL_KEYWORDS)) {
    signals.push("personal_keyword");

    return {
      domain: "personal",
      signals,
    };
  }

  if (hasKeyword(corpus, ARCHIVE_KEYWORDS) || sourceKind === "import") {
    signals.push("archive_keyword");

    return {
      domain: "archive",
      signals,
    };
  }

  return {
    domain: "general",
    signals,
  };
};

const deriveSensitivity = (
  asset: AssetDetail,
  domain: AssetDomain,
  corpus: string,
  sourceHost: string | null
): { sensitivity: AssetSensitivity; reasons: string[] } => {
  const reasons: string[] = [];

  if (hasKeyword(corpus, RESTRICTED_KEYWORDS)) {
    reasons.push("restricted_keyword");

    return {
      sensitivity: "restricted",
      reasons,
    };
  }

  if (hasKeyword(corpus, PRIVATE_KEYWORDS)) {
    reasons.push("private_keyword");

    return {
      sensitivity: "private",
      reasons,
    };
  }

  if (domain === "personal" || domain === "finance" || domain === "health") {
    reasons.push(`domain:${domain}`);

    return {
      sensitivity: "private",
      reasons,
    };
  }

  if (
    sourceHost &&
    PUBLIC_HOST_HINTS.some(
      (hint) => sourceHost === hint || sourceHost.includes(hint)
    )
  ) {
    reasons.push("public_host");

    return {
      sensitivity: "public",
      reasons,
    };
  }

  if (asset.type === "url" && sourceHost) {
    reasons.push("web_url_default");

    return {
      sensitivity: "public",
      reasons,
    };
  }

  reasons.push("default_internal");

  return {
    sensitivity: "internal",
    reasons,
  };
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

export const deriveDescriptor = (
  context: DeriveIndexingContext
): DescriptorResult => {
  const sourceHost = extractSourceHost(context.asset);
  const sourceKind = getSourceKind(context.asset);
  const corpus = collectCorpus(context);
  const { domain, signals } = deriveDomain(context.asset, corpus, sourceHost);
  const collectionKey = deriveCollectionKey(context.asset, sourceHost);
  const descriptor: AssetDescriptor = {
    version: 1,
    strategy: "heuristic_v1",
    assetType: context.asset.type,
    sourceKind,
    domain,
    collectionKey,
    capturedAt: context.asset.capturedAt ?? context.asset.createdAt,
    sourceHost,
    language: normalizeText(context.asset.language) || null,
    mimeType: normalizeText(context.asset.mimeType) || null,
    signals,
  };

  return {
    descriptor,
    indexing: {
      sourceKind,
      domain,
      collectionKey,
      capturedAt: descriptor.capturedAt,
      descriptorJson: JSON.stringify(descriptor),
    },
  };
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
