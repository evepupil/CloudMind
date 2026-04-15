import type {
  CreateAssetAssertionInput,
  CreateAssetFacetInput,
  UpdateAssetIndexingInput,
} from "@/core/assets/ports";
import type {
  AssetAiVisibility,
  AssetAssertionKind,
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
] as const;

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
] as const;

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
] as const;

const PUBLIC_HOST_HINTS = [
  "developers.cloudflare.com",
  "docs.",
  "developer.",
  "github.com",
  "arxiv.org",
  "wikipedia.org",
] as const;

const DESIGN_KEYWORDS = [
  "design",
  "architecture",
  "schema",
  "migration",
  "workflow",
  "plan",
] as const;

const HOWTO_KEYWORDS = [
  "guide",
  "tutorial",
  "how to",
  "getting started",
  "step by step",
  "quickstart",
] as const;

const MEETING_KEYWORDS = [
  "meeting",
  "sync",
  "retro",
  "standup",
  "discussion",
] as const;

const TOPIC_RULES: Array<{
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

const ASSERTION_DECISION_KEYWORDS = [
  "decide",
  "decided",
  "adopt",
  "choose",
  "chosen",
  "will use",
  "采用",
  "决定",
] as const;

const ASSERTION_CONSTRAINT_KEYWORDS = [
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

const SEMANTIC_FACET_KEYS = new Set<AssetFacetKey>([
  "collection",
  "topic",
  "tag",
]);

const GENERIC_SEMANTIC_FACET_VALUES = new Set([
  "document",
  "documents",
  "doc",
  "docs",
  "note",
  "notes",
  "summary",
  "general",
]);

type FacetCandidate = Pick<
  CreateAssetFacetInput,
  "facetKey" | "facetValue" | "facetLabel" | "sortOrder"
>;

const normalizeText = (value: string | null | undefined): string => {
  return value?.trim().toLowerCase() ?? "";
};

const normalizeFacetText = (value: string | null | undefined): string => {
  return value?.trim().replace(/\s+/g, " ") ?? "";
};

const normalizeFacetLookupKey = (value: string | null | undefined): string => {
  return normalizeFacetText(value).toLowerCase();
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

const deriveDocumentClass = (
  asset: AssetDetail,
  domain: AssetDomain,
  corpus: string,
  sourceHost: string | null
): AssetDocumentClass => {
  if (hasKeyword(corpus, MEETING_KEYWORDS)) {
    return "meeting_note";
  }

  if (domain === "research" || hasKeyword(corpus, RESEARCH_KEYWORDS)) {
    return "paper";
  }

  if (domain === "product" && hasKeyword(corpus, PRODUCT_KEYWORDS)) {
    return "spec";
  }

  if (domain === "engineering" && hasKeyword(corpus, DESIGN_KEYWORDS)) {
    return "design_doc";
  }

  if (domain === "engineering" && corpus.includes("bug")) {
    return "bug_note";
  }

  if (
    hasKeyword(corpus, HOWTO_KEYWORDS) ||
    sourceHost?.startsWith("docs.") ||
    sourceHost?.startsWith("developer.") ||
    sourceHost?.includes("developers.cloudflare.com")
  ) {
    return "howto";
  }

  if (domain === "personal") {
    return "journal_entry";
  }

  if (asset.type === "note" || asset.type === "chat") {
    return "general_note";
  }

  return "reference_doc";
};

const deriveTopics = (corpus: string): string[] => {
  return TOPIC_RULES.filter((rule) =>
    rule.keywords.some((keyword) => corpus.includes(keyword))
  )
    .map((rule) => rule.topic)
    .slice(0, 3);
};

const deriveTags = (topics: string[]): string[] => {
  return topics.slice(0, 5);
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

const pushFacet = (
  facets: CreateAssetFacetInput[],
  facetKey: AssetFacetKey,
  facetValue: string | null | undefined,
  facetLabel: string | null | undefined,
  sortOrder: number
): void => {
  if (!facetValue?.trim() || !facetLabel?.trim()) {
    return;
  }

  facets.push({
    facetKey,
    facetValue,
    facetLabel,
    sortOrder,
  });
};

const sanitizeSemanticFacet = (
  facet: FacetCandidate
): FacetCandidate | null => {
  if (!SEMANTIC_FACET_KEYS.has(facet.facetKey)) {
    return null;
  }

  const facetValue = normalizeFacetText(facet.facetValue);
  const facetLabel = normalizeFacetText(facet.facetLabel) || facetValue;

  if (!facetValue || !facetLabel) {
    return null;
  }

  if (
    facet.facetKey !== "collection" &&
    GENERIC_SEMANTIC_FACET_VALUES.has(normalizeFacetLookupKey(facetValue))
  ) {
    return null;
  }

  return {
    facetKey: facet.facetKey,
    facetValue,
    facetLabel,
    sortOrder: facet.sortOrder,
  };
};

const reindexFacets = (
  facets: CreateAssetFacetInput[]
): CreateAssetFacetInput[] => {
  return facets.map((facet, index) => ({
    ...facet,
    sortOrder: index,
  }));
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

export const deriveDescriptor = (
  context: DeriveIndexingContext
): DescriptorResult => {
  const sourceHost = extractSourceHost(context.asset);
  const sourceKind = getSourceKind(context.asset);
  const corpus = collectCorpus(context);
  const { domain, signals } = deriveDomain(context.asset, corpus, sourceHost);
  const documentClass = deriveDocumentClass(
    context.asset,
    domain,
    corpus,
    sourceHost
  );
  const topics = deriveTopics(corpus);
  const tags = deriveTags(topics);
  const collectionKey = deriveCollectionKey(context.asset, sourceHost);
  const descriptor: AssetDescriptor = {
    version: 2,
    strategy: "heuristic_v2",
    assetType: context.asset.type,
    sourceKind,
    domain,
    documentClass,
    topics,
    tags,
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
      documentClass,
      sourceHost,
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

export const deriveSystemFacets = (
  descriptor: AssetDescriptor,
  policy: AssetAccessPolicy
): CreateAssetFacetInput[] => {
  const facets: CreateAssetFacetInput[] = [];
  const capturedYear = descriptor.capturedAt?.slice(0, 4) ?? null;

  pushFacet(facets, "domain", descriptor.domain, descriptor.domain, 0);
  pushFacet(
    facets,
    "document_class",
    descriptor.documentClass,
    descriptor.documentClass,
    1
  );
  pushFacet(
    facets,
    "asset_type",
    descriptor.assetType,
    descriptor.assetType,
    2
  );
  pushFacet(
    facets,
    "source_kind",
    descriptor.sourceKind,
    descriptor.sourceKind,
    3
  );
  pushFacet(
    facets,
    "source_host",
    descriptor.sourceHost,
    descriptor.sourceHost,
    4
  );
  pushFacet(facets, "year", capturedYear, capturedYear, 5);
  pushFacet(
    facets,
    "ai_visibility",
    policy.aiVisibility,
    policy.aiVisibility,
    6
  );
  pushFacet(facets, "sensitivity", policy.sensitivity, policy.sensitivity, 7);

  return facets;
};

export const deriveSemanticFacets = (
  descriptor: AssetDescriptor
): CreateAssetFacetInput[] => {
  const facets: CreateAssetFacetInput[] = [];

  pushFacet(
    facets,
    "collection",
    descriptor.collectionKey,
    descriptor.collectionKey,
    20
  );

  descriptor.topics.forEach((topic, index) => {
    pushFacet(facets, "topic", topic, topic, 30 + index);
  });

  descriptor.tags.forEach((tag, index) => {
    pushFacet(facets, "tag", tag, tag, 50 + index);
  });

  return facets;
};

const mergeSemanticFacets = (
  baseFacets: CreateAssetFacetInput[],
  clientFacets: ReadonlyArray<FacetCandidate> | null | undefined
): CreateAssetFacetInput[] => {
  const merged: CreateAssetFacetInput[] = [];
  const deduped = new Set<string>();
  let hasCollection = false;

  const tryPush = (facet: FacetCandidate | null) => {
    const sanitized = facet ? sanitizeSemanticFacet(facet) : null;

    if (!sanitized) {
      return;
    }

    if (sanitized.facetKey === "collection") {
      if (hasCollection) {
        return;
      }

      hasCollection = true;
    }

    const dedupeKey = `${sanitized.facetKey}:${normalizeFacetLookupKey(
      sanitized.facetValue
    )}`;

    if (deduped.has(dedupeKey)) {
      return;
    }

    deduped.add(dedupeKey);
    merged.push({
      facetKey: sanitized.facetKey,
      facetValue: sanitized.facetValue,
      facetLabel: sanitized.facetLabel,
      sortOrder: sanitized.sortOrder,
    });
  };

  for (const facet of baseFacets) {
    tryPush(facet);
  }

  for (const facet of clientFacets ?? []) {
    tryPush(facet);
  }

  return merged;
};

// 这里把最终 descriptor / policy 投影成 facets，并只允许客户端补充语义类 facet。
export const deriveFacets = (
  descriptor: AssetDescriptor,
  policy: AssetAccessPolicy,
  clientFacets?: ReadonlyArray<FacetCandidate> | null | undefined
): CreateAssetFacetInput[] => {
  return reindexFacets([
    ...deriveSystemFacets(descriptor, policy),
    ...mergeSemanticFacets(deriveSemanticFacets(descriptor), clientFacets),
  ]);
};

// 这里提取少量高价值断言，先服务结构化召回，不追求完整信息抽取。
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
