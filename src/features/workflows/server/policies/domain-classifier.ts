import type {
  AssetDetail,
  AssetDocumentClass,
  AssetDomain,
} from "@/features/assets/model/types";
import type {
  DeriveIndexingContext,
  DescriptorResult,
} from "./types-and-helpers";
import {
  type AssetDescriptor,
  collectCorpus,
  DESIGN_KEYWORDS,
  ENGINEERING_KEYWORDS,
  extractSourceHost,
  FINANCE_KEYWORDS,
  getSourceKind,
  HEALTH_KEYWORDS,
  HOWTO_KEYWORDS,
  hasKeyword,
  MEETING_KEYWORDS,
  normalizeText,
  PERSONAL_KEYWORDS,
  PRODUCT_KEYWORDS,
  RESEARCH_KEYWORDS,
  TOPIC_RULES,
} from "./types-and-helpers";

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

    return { domain: "research", signals };
  }

  if (
    hasKeyword(corpus, ENGINEERING_KEYWORDS) ||
    sourceHost?.includes("github.com") ||
    sourceHost?.includes("developers.cloudflare.com") ||
    sourceHost?.startsWith("docs.") ||
    sourceHost?.startsWith("developer.")
  ) {
    signals.push("engineering_keyword");

    return { domain: "engineering", signals };
  }

  if (hasKeyword(corpus, PRODUCT_KEYWORDS)) {
    signals.push("product_keyword");

    return { domain: "product", signals };
  }

  if (hasKeyword(corpus, FINANCE_KEYWORDS)) {
    signals.push("finance_keyword");

    return { domain: "finance", signals };
  }

  if (hasKeyword(corpus, HEALTH_KEYWORDS)) {
    signals.push("health_keyword");

    return { domain: "health", signals };
  }

  if (hasKeyword(corpus, PERSONAL_KEYWORDS)) {
    signals.push("personal_keyword");

    return { domain: "personal", signals };
  }

  if (
    hasKeyword(corpus, [
      "archive",
      "backup",
      "snapshot",
      "history",
      "legacy",
      "imported",
      "old version",
    ]) ||
    sourceKind === "import"
  ) {
    signals.push("archive_keyword");

    return { domain: "archive", signals };
  }

  return { domain: "general", signals };
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
