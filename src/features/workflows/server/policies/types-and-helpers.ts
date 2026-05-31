import type {
  AssetDetail,
  AssetDocumentClass,
  AssetDomain,
  AssetFacetKey,
  AssetSensitivity,
} from "@/features/assets/model/types";

interface DeriveIndexingContext {
  asset: AssetDetail;
  normalizedContent?: string | null | undefined;
  summary?: string | null | undefined;
}

export interface AssetDescriptor {
  version: 2;
  strategy: "heuristic_v2";
  assetType: AssetDetail["type"];
  sourceKind: AssetDetail["sourceKind"];
  domain: AssetDomain;
  documentClass: AssetDocumentClass;
  topics: string[];
  tags: string[];
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
  aiVisibility: AssetSensitivity extends string
    ? "allow" | "summary_only" | "deny"
    : never;
  retrievalPriority: number;
  reasons: string[];
}

export interface DescriptorResult {
  descriptor: AssetDescriptor;
  indexing: import("@/core/assets/ports").UpdateAssetIndexingInput;
}

export interface AccessPolicyResult {
  policy: AssetAccessPolicy;
  indexing: import("@/core/assets/ports").UpdateAssetIndexingInput;
}

export const normalizeText = (value: string | null | undefined): string => {
  return value?.trim().toLowerCase() ?? "";
};

export const normalizeFacetText = (
  value: string | null | undefined
): string => {
  return value?.trim().replace(/\s+/g, " ") ?? "";
};

export const normalizeFacetLookupKey = (
  value: string | null | undefined
): string => {
  return normalizeFacetText(value).toLowerCase();
};

export const getSourceKind = (
  asset: AssetDetail
): AssetDetail["sourceKind"] => {
  return asset.sourceKind ?? asset.source?.kind ?? null;
};

export const collectCorpus = (context: DeriveIndexingContext): string => {
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

export const hasKeyword = (
  corpus: string,
  keywords: readonly string[]
): boolean => {
  return keywords.some((keyword) => corpus.includes(keyword));
};

export const extractSourceHost = (asset: AssetDetail): string | null => {
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

export const ENGINEERING_KEYWORDS = [
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

export const PRODUCT_KEYWORDS = [
  "prd",
  "roadmap",
  "requirement",
  "user story",
  "feature",
  "product",
  "metric",
  "launch",
] as const;

export const RESEARCH_KEYWORDS = [
  "paper",
  "whitepaper",
  "study",
  "research",
  "abstract",
  "doi",
  "journal",
  "arxiv",
] as const;

export const PERSONAL_KEYWORDS = [
  "diary",
  "journal",
  "family",
  "travel",
  "birthday",
  "memory",
  "personal",
] as const;

export const FINANCE_KEYWORDS = [
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

export const HEALTH_KEYWORDS = [
  "medical",
  "health",
  "hospital",
  "diagnosis",
  "symptom",
  "prescription",
  "sleep",
  "exercise",
] as const;

export const ARCHIVE_KEYWORDS = [
  "archive",
  "backup",
  "snapshot",
  "history",
  "legacy",
  "imported",
  "old version",
] as const;

export const RESTRICTED_KEYWORDS = [
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
] as const;

export const PRIVATE_KEYWORDS = [
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
] as const;

export const PUBLIC_HOST_HINTS = [
  "developers.cloudflare.com",
  "docs.",
  "developer.",
  "github.com",
  "arxiv.org",
  "wikipedia.org",
] as const;

export const DESIGN_KEYWORDS = [
  "design",
  "architecture",
  "schema",
  "migration",
  "workflow",
  "plan",
] as const;

export const HOWTO_KEYWORDS = [
  "guide",
  "tutorial",
  "how to",
  "getting started",
  "step by step",
  "quickstart",
] as const;

export const MEETING_KEYWORDS = [
  "meeting",
  "sync",
  "retro",
  "standup",
  "discussion",
] as const;

export const TOPIC_RULES: Array<{
  topic: string;
  keywords: readonly string[];
}> = [
  {
    topic: "typescript",
    keywords: ["typescript", "ts", "tsconfig"],
  },
  {
    topic: "retrieval",
    keywords: ["retrieval", "search", "semantic", "rag"],
  },
  {
    topic: "mcp",
    keywords: ["mcp", "model context protocol"],
  },
  {
    topic: "workflow",
    keywords: ["workflow", "queue", "consumer", "job"],
  },
  {
    topic: "vector",
    keywords: ["vector", "embedding", "vectorize"],
  },
  {
    topic: "database",
    keywords: ["d1", "drizzle", "sql", "migration", "schema"],
  },
  {
    topic: "cloudflare",
    keywords: ["cloudflare", "workers", "r2", "d1", "vectorize"],
  },
  {
    topic: "debugging",
    keywords: ["bug", "debug", "incident", "failure"],
  },
];

export const ASSERTION_DECISION_KEYWORDS = [
  "decide",
  "decided",
  "adopt",
  "choose",
  "chosen",
  "will use",
  "采用",
  "决定",
] as const;

export const ASSERTION_CONSTRAINT_KEYWORDS = [
  "must",
  "should",
  "need to",
  "cannot",
  "don't",
  "do not",
  "禁止",
  "不要",
  "必须",
] as const;

export const SEMANTIC_FACET_KEYS = new Set<AssetFacetKey>([
  "collection",
  "topic",
  "tag",
]);

export const GENERIC_SEMANTIC_FACET_VALUES = new Set([
  "document",
  "documents",
  "doc",
  "docs",
  "note",
  "notes",
  "summary",
  "general",
]);

export type { DeriveIndexingContext };
