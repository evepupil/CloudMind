import type {
  AssetAiVisibility,
  AssetDetail,
  AssetDomain,
  AssetSourceKind,
} from "@/features/assets/model/types";

// 这里是 L1 瘦身后的单一启发式分类器：只产出"被捕获的客观元数据"
// （domain / aiVisibility / retrievalPriority / sourceKind / sourceHost /
// collectionKey / capturedAt），不再派生 documentClass / descriptor /
// topics / tags / facets / assertions（这些语义派生物归属 L2 知识图谱）。
// 全程零 AI 调用，纯关键词与来源启发，保证摘取链路稳定不被模型抖动阻塞。

export interface ClassifyContext {
  asset: AssetDetail;
  normalizedContent?: string | null | undefined;
  summary?: string | null | undefined;
}

export interface ClassifyResult {
  sourceKind: AssetSourceKind | null;
  domain: AssetDomain;
  aiVisibility: AssetAiVisibility;
  retrievalPriority: number;
  sourceHost: string | null;
  collectionKey: string | null;
  capturedAt: string | null;
  signals: string[];
}

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
  // 中文高信号财务词：命中即判 finance 域（进而 summary_only），避免中文敏感财务记忆漏门控。
  "发票",
  "收据",
  "银行",
  "报税",
  "工资",
  "薪资",
  "薪水",
  "预算",
  "支出",
  "报销",
  "财务",
  "收入",
  "储蓄",
  "存款",
  "按揭",
  "房贷",
  "贷款",
  "理财",
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
  // 中文健康/医疗词：命中即判 health 域（进而 summary_only）。
  "医疗",
  "健康",
  "医院",
  "诊断",
  "症状",
  "处方",
  "病历",
  "体检",
  "用药",
  "锻炼",
] as const;

const PERSONAL_KEYWORDS = [
  "diary",
  "journal",
  "family",
  "travel",
  "birthday",
  "memory",
  "personal",
  // 中文私人生活词：命中即判 personal 域（进而 summary_only）。
  "日记",
  "家庭",
  "家人",
  "旅行",
  "生日",
  "私人",
  "回忆",
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

// 命中即判定为 deny（绝不进入语义检索）的高敏感关键词。
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
  // 中文高敏感凭证/证件词：命中即判 deny（绝不进语义检索）。
  // 证件类用「号」后缀降低误伤（如「上传身份证照片」不含「号」不命中）。
  "密码",
  "口令",
  "私钥",
  "助记词",
  "身份证号",
  "护照号",
  "银行卡号",
  "信用卡号",
] as const;

// 命中即判定为 summary_only（仅摘要可见）的私密关键词。
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
  // 中文私密词：命中即判 summary_only（仅摘要可见，原文不进 chunk 通道）。
  "工资",
  "薪资",
  "薪水",
  "银行账户",
  "银行账号",
  "住址",
  "家庭住址",
  "手机号",
  "电话号码",
  "邮箱",
  "简历",
  "日记",
  "诊断",
  "发票",
  "收入",
  "存款",
] as const;

const getSourceKind = (asset: AssetDetail): AssetSourceKind | null => {
  return asset.sourceKind ?? asset.source?.kind ?? null;
};

const collectCorpus = (context: ClassifyContext): string => {
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

  if (hasKeyword(corpus, ARCHIVE_KEYWORDS) || sourceKind === "import") {
    signals.push("archive_keyword");

    return { domain: "archive", signals };
  }

  return { domain: "general", signals };
};

// 直接从关键词/领域推出 AI 可见性，去掉旧的 sensitivity 中间层：
// 高敏感关键词 → deny；私密关键词或私密领域 → summary_only；其余 → allow。
const deriveAiVisibility = (
  domain: AssetDomain,
  corpus: string
): { aiVisibility: AssetAiVisibility; signals: string[] } => {
  const signals: string[] = [];

  if (hasKeyword(corpus, RESTRICTED_KEYWORDS)) {
    signals.push("restricted_keyword");

    return { aiVisibility: "deny", signals };
  }

  if (hasKeyword(corpus, PRIVATE_KEYWORDS)) {
    signals.push("private_keyword");

    return { aiVisibility: "summary_only", signals };
  }

  if (domain === "personal" || domain === "finance" || domain === "health") {
    signals.push(`private_domain:${domain}`);

    return { aiVisibility: "summary_only", signals };
  }

  return { aiVisibility: "allow", signals };
};

const deriveRetrievalPriority = (
  asset: AssetDetail,
  domain: AssetDomain,
  aiVisibility: AssetAiVisibility,
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

  if (aiVisibility === "summary_only") {
    priority -= 15;
  }

  if (aiVisibility === "deny") {
    priority -= 40;
  }

  return priority;
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

export const classifyAsset = (context: ClassifyContext): ClassifyResult => {
  const sourceHost = extractSourceHost(context.asset);
  const sourceKind = getSourceKind(context.asset);
  const corpus = collectCorpus(context);
  const { domain, signals: domainSignals } = deriveDomain(
    context.asset,
    corpus,
    sourceHost
  );
  const { aiVisibility, signals: visibilitySignals } = deriveAiVisibility(
    domain,
    corpus
  );
  const retrievalPriority = deriveRetrievalPriority(
    context.asset,
    domain,
    aiVisibility,
    sourceHost
  );
  const collectionKey = deriveCollectionKey(context.asset, sourceHost);

  return {
    sourceKind,
    domain,
    aiVisibility,
    retrievalPriority,
    sourceHost,
    collectionKey,
    capturedAt: context.asset.capturedAt ?? context.asset.createdAt,
    signals: [...domainSignals, ...visibilitySignals],
  };
};
