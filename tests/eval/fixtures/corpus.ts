// 这里定义离线 eval 的种子语料，并据此构建可注入 createSearchService 的全套 fake 依赖。
// 目标：用真实的 search service 排序逻辑跑一组金标准查询，使每次检索改动都有可度量的 delta。

import type { AIProvider, RerankInput, RerankResult } from "@/core/ai/ports";
import type {
  AssetSearchInput,
  AssetSearchRepository,
  ChunkMatchQuery,
  SearchAssetSummaryInput,
} from "@/core/assets/ports";
import type {
  VectorSearchInput,
  VectorSearchMatch,
  VectorStore,
} from "@/core/vector/ports";
import type {
  AssetChunkMatch,
  AssetDomain,
  AssetListResult,
  AssetSearchFilters,
  AssetSummary,
  AssetSummaryMatch,
} from "@/features/assets/model/types";
import {
  containsAnyToken,
  cosineSimilarity,
  deterministicEmbedding,
  queryTokens,
} from "./embedding";

export interface CorpusAsset {
  id: string;
  title: string;
  summary: string;
  domain: AssetDomain;
  aiVisibility?: AssetSummary["aiVisibility"] | undefined;
  chunks: string[];
  capturedAt?: string | undefined;
}

// 这里是种子语料：中英文混合的个人知识库样本，每条资产的 chunk 文本携带可区分 token。
export const CORPUS: CorpusAsset[] = [
  {
    id: "cf-d1",
    title: "Cloudflare D1",
    summary: "Cloudflare D1 serverless SQLite database overview.",
    domain: "engineering",
    chunks: [
      "Cloudflare D1 is a serverless SQLite database that runs at the edge with Drizzle ORM and migrations.",
      "D1 supports the SQLite FTS5 full text search module and the trigram tokenizer for CJK content.",
    ],
  },
  {
    id: "cf-vectorize",
    title: "Cloudflare Vectorize",
    summary: "Vectorize vector index with native metadata filtering.",
    domain: "engineering",
    chunks: [
      "Cloudflare Vectorize is a vector index that supports native metadata filtering applied before topK and cosine similarity.",
      "Vectorize namespaces partition vectors and metadata indexes must be declared before upserting vectors.",
    ],
  },
  {
    id: "cf-r2",
    title: "Cloudflare R2",
    summary: "R2 object storage that is S3 compatible with no egress fees.",
    domain: "engineering",
    chunks: [
      "Cloudflare R2 is object storage that is S3 compatible and charges no egress fees for stored files and blobs.",
    ],
  },
  {
    id: "rag-basics",
    title: "Retrieval Augmented Generation",
    summary: "RAG fundamentals: chunking, embeddings, retrieval, grounding.",
    domain: "research",
    chunks: [
      "Retrieval augmented generation, RAG, retrieves relevant chunks via embeddings and grounds the language model answer in sources.",
      "A RAG pipeline splits documents into chunks, embeds them, stores vectors, and retrieves the top results for a query.",
    ],
  },
  {
    id: "bge-m3",
    title: "BGE-M3 Embedding Model",
    summary: "Multilingual embedding model with 1024 dimensions.",
    domain: "research",
    chunks: [
      "bge-m3 is a multilingual embedding model with 1024 dimensions supporting dense, sparse, and colbert multi vector retrieval.",
    ],
  },
  {
    id: "mcp-server",
    title: "Model Context Protocol",
    summary: "Stateless remote MCP server exposing tools to AI clients.",
    domain: "engineering",
    chunks: [
      "The Model Context Protocol, MCP, defines a stateless remote server that exposes tools to AI clients over HTTP.",
    ],
  },
  {
    id: "rrf-fusion",
    title: "Reciprocal Rank Fusion",
    summary: "RRF combines multiple ranked lists for hybrid search.",
    domain: "research",
    chunks: [
      "Reciprocal rank fusion, RRF, combines multiple ranked lists into one hybrid search ranking using reciprocal ranks and is scale free.",
    ],
  },
  {
    id: "ts-strict",
    title: "TypeScript Strict Mode",
    summary: "Strict compiler options for safer TypeScript.",
    domain: "engineering",
    chunks: [
      "TypeScript strict mode enables noUncheckedIndexedAccess and exactOptionalPropertyTypes and verbatimModuleSyntax for safer compiler checks.",
    ],
  },
  {
    id: "memory-layer",
    title: "AI Memory Layer",
    summary: "Memory layers vs RAG: mem0, Zep, Letta knowledge graphs.",
    domain: "research",
    chunks: [
      "An AI memory layer adds a write path that extracts facts and entities into a knowledge graph, unlike plain RAG over chunks.",
      "Systems like mem0, Zep, and Letta model episodic and semantic memory with temporal validity and consolidation.",
    ],
  },
  {
    id: "cf-queues",
    title: "Cloudflare Queues",
    summary: "Async processing with producers, consumers, and retries.",
    domain: "engineering",
    chunks: [
      "Cloudflare Queues enable async processing with producers and consumers, batching messages and retrying on failure.",
    ],
  },
  {
    id: "reranker",
    title: "Cross-Encoder Reranker",
    summary: "bge-reranker-base cross encoder for relevance scoring.",
    domain: "research",
    chunks: [
      "A cross encoder reranker like bge-reranker-base scores query document relevance and reorders the top candidates after recall.",
    ],
  },
  {
    id: "zh-vector",
    title: "向量检索基础",
    summary: "向量检索、语义搜索与嵌入模型概述。",
    domain: "research",
    chunks: [
      "向量检索通过嵌入模型把文本变成向量，用余弦相似度做语义搜索和召回。",
      "多语言嵌入模型可以同时处理中文和英文的语义召回。",
    ],
  },
  {
    id: "zh-memory",
    title: "个人记忆层",
    summary: "个人私有化记忆层、知识图谱与遗忘机制。",
    domain: "research",
    chunks: [
      "个人记忆层把事实抽取成知识图谱，带时间维度，可以整合与遗忘，主打私有部署。",
      "记忆层和普通检索的区别在于有写路径，可以更新和遗忘记忆。",
    ],
  },
  {
    id: "zh-coffee",
    title: "手冲咖啡笔记",
    summary: "手冲咖啡的水温、研磨度与粉水比。",
    domain: "personal",
    chunks: [
      "手冲咖啡建议水温九十二度，研磨度中细，粉水比大约一比十五，先闷蒸再注水。",
    ],
  },
  {
    id: "zh-fitness",
    title: "力量训练笔记",
    summary: "力量训练的复合动作与恢复。",
    domain: "personal",
    chunks: ["力量训练以复合动作为主，比如深蹲和硬拉，注意蛋白质摄入和恢复。"],
  },
];

const ISO = "2026-03-19T00:00:00.000Z";

// 这里把 CorpusAsset 投影为 search service 需要的 AssetSummary。
const toAssetSummary = (asset: CorpusAsset): AssetSummary => ({
  id: asset.id,
  type: "note",
  title: asset.title,
  summary: asset.summary,
  sourceUrl: null,
  sourceKind: "manual",
  status: "ready",
  domain: asset.domain,
  aiVisibility: asset.aiVisibility ?? "allow",
  retrievalPriority: 0,
  scopeId: "personal",
  collectionKey: "inbox:notes",
  capturedAt: asset.capturedAt ?? ISO,
  createdAt: asset.capturedAt ?? ISO,
  updatedAt: asset.capturedAt ?? ISO,
});

interface ChunkVector {
  vectorId: string;
  values: number[];
}

interface BuiltCorpus {
  chunkByVectorId: Map<string, AssetChunkMatch>;
  chunkVectors: ChunkVector[];
  summaries: AssetSummaryMatch[];
}

const buildCorpus = (corpus: CorpusAsset[]): BuiltCorpus => {
  const chunkByVectorId = new Map<string, AssetChunkMatch>();
  const chunkVectors: ChunkVector[] = [];
  const summaries: AssetSummaryMatch[] = [];

  for (const corpusAsset of corpus) {
    const asset = toAssetSummary(corpusAsset);

    corpusAsset.chunks.forEach((text, index) => {
      const vectorId = `${asset.id}:${index}`;

      chunkByVectorId.set(vectorId, {
        id: `${asset.id}-c${index}`,
        chunkIndex: index,
        textPreview: text.slice(0, 180),
        contentText: text,
        vectorId,
        asset,
      });
      chunkVectors.push({ vectorId, values: deterministicEmbedding(text) });
    });

    summaries.push({ asset, summary: asset.summary ?? "" });
  }

  return { chunkByVectorId, chunkVectors, summaries };
};

const matchesFilters = (
  asset: AssetSummary,
  query: ChunkMatchQuery | undefined
): boolean => {
  if (!query) {
    return true;
  }

  if (
    query.aiVisibility?.length &&
    !query.aiVisibility.includes(asset.aiVisibility)
  ) {
    return false;
  }

  if (query.domain && asset.domain !== query.domain) {
    return false;
  }

  if (query.sourceKind && asset.sourceKind !== query.sourceKind) {
    return false;
  }

  return true;
};

// 这里让词面通道也尊重硬过滤（domain/type/sourceKind），用于过滤正确性金标准。
const matchesQueryFilters = (
  asset: AssetSummary,
  filters: AssetSearchFilters
): boolean => {
  if (filters.domain && asset.domain !== filters.domain) {
    return false;
  }
  if (filters.type && asset.type !== filters.type) {
    return false;
  }
  if (filters.sourceKind && asset.sourceKind !== filters.sourceKind) {
    return false;
  }

  return true;
};

// 这里把检索管线拆成可单独度量的阶段：
//   lexical  仅词面（summary/FTS chunk）
//   dense    仅向量语义
//   fused    跨通道融合（min-max 归一化）
//   reranked 融合后再 cross-encoder 重排 + MMR
// 每阶段独立跑 eval，使各阶段贡献可归因、回归可定位。
export interface StageConfig {
  dense: boolean;
  lexical: boolean;
  rerank: boolean;
}

export const PIPELINE_STAGES = {
  lexical: { dense: false, lexical: true, rerank: false },
  dense: { dense: true, lexical: false, rerank: false },
  fused: { dense: true, lexical: true, rerank: false },
  reranked: { dense: true, lexical: true, rerank: true },
} as const satisfies Record<string, StageConfig>;

export type PipelineStageName = keyof typeof PIPELINE_STAGES;

export interface EvalDependencies {
  getAssetRepository: () => AssetSearchRepository;
  getVectorStore: () => VectorStore;
  getAIProvider: () => AIProvider;
}

// 这里把语料组装成 createSearchService 可直接消费的依赖集合。
export const buildEvalDependencies = (
  corpus: CorpusAsset[] = CORPUS,
  stage: StageConfig = PIPELINE_STAGES.reranked
): EvalDependencies => {
  const built = buildCorpus(corpus);

  const repository: AssetSearchRepository = {
    async searchAssets(_input: AssetSearchInput): Promise<AssetListResult> {
      return {
        items: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      };
    },

    async getChunkMatchesByVectorIds(
      vectorIds: string[],
      query?: ChunkMatchQuery
    ): Promise<AssetChunkMatch[]> {
      const matches: AssetChunkMatch[] = [];

      for (const vectorId of vectorIds) {
        const chunk = built.chunkByVectorId.get(vectorId);

        if (chunk && matchesFilters(chunk.asset, query)) {
          matches.push(chunk);
        }
      }

      return matches;
    },

    async searchAssetSummaries(
      input: SearchAssetSummaryInput
    ): Promise<AssetSummaryMatch[]> {
      if (!stage.lexical) {
        return [];
      }

      const tokens = queryTokens(input.query);

      return built.summaries
        .filter((match) =>
          input.aiVisibility.includes(match.asset.aiVisibility)
        )
        .filter((match) => matchesQueryFilters(match.asset, input))
        .filter((match) =>
          containsAnyToken(`${match.asset.title} ${match.summary}`, tokens)
        )
        .slice(0, input.limit);
    },

    async searchChunksByText(
      input: SearchAssetSummaryInput
    ): Promise<AssetChunkMatch[]> {
      if (!stage.lexical) {
        return [];
      }

      const tokens = queryTokens(input.query);

      // 词面 chunk 通道：按 query token 在 chunk 文本里的命中数排序（BM25 的确定性替身）。
      return [...built.chunkByVectorId.values()]
        .filter((chunk) =>
          input.aiVisibility.includes(chunk.asset.aiVisibility)
        )
        .filter((chunk) => matchesQueryFilters(chunk.asset, input))
        .map((chunk) => ({
          chunk,
          overlap: tokens.filter((token) =>
            (chunk.contentText ?? "").toLowerCase().includes(token)
          ).length,
        }))
        .filter((entry) => entry.overlap > 0)
        .sort((left, right) => right.overlap - left.overlap)
        .slice(0, input.limit)
        .map((entry) => entry.chunk);
    },
  };

  const vectorStore: VectorStore = {
    async upsert(): Promise<void> {
      return undefined;
    },

    async search(input: VectorSearchInput): Promise<VectorSearchMatch[]> {
      if (!stage.dense) {
        return [];
      }

      return built.chunkVectors
        .map((entry) => ({
          id: entry.vectorId,
          score: cosineSimilarity(input.values, entry.values),
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, input.topK);
    },

    async deleteByIds(): Promise<void> {
      return undefined;
    },
  };

  const aiProvider: AIProvider = {
    async generateText() {
      return { text: "" };
    },

    async createEmbeddings(input) {
      return {
        embeddings: input.texts.map((text) => deterministicEmbedding(text)),
      };
    },

    // 确定性 fake reranker：用 hash-embedding 余弦近似 cross-encoder 相关性，
    // 让 eval 在无 Cloudflare 依赖下覆盖 T7 重排接线；stage.rerank 关闭时省略该方法。
    ...(stage.rerank
      ? {
          async rerank(input: RerankInput): Promise<RerankResult[]> {
            const queryVector = deterministicEmbedding(input.query);

            return input.documents
              .map((text, index) => ({
                index,
                score: cosineSimilarity(
                  queryVector,
                  deterministicEmbedding(text)
                ),
              }))
              .sort((left, right) => right.score - left.score);
          },
        }
      : {}),
  };

  return {
    getAssetRepository: () => repository,
    getVectorStore: () => vectorStore,
    getAIProvider: () => aiProvider,
  };
};
