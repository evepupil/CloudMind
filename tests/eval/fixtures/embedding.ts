// 这里实现一个确定性的本地 embedding，用于离线 eval：
// 让向量余弦相似度近似 token 重叠（覆盖中英文），从而无需任何 Cloudflare 依赖即可驱动真实的 search service 排序。

const DIM = 96;

// 这里把文本切成可哈希的 token：拉丁词 + CJK 单字 + CJK 二元组，兼顾中英文召回信号。
const tokenize = (text: string): string[] => {
  const lower = text.toLowerCase();
  const latin = lower.match(/[a-z0-9]{2,}/g) ?? [];
  const cjk = lower.match(/[一-鿿]/g) ?? [];
  const bigrams: string[] = [];

  for (let i = 0; i < cjk.length - 1; i += 1) {
    const head = cjk[i];
    const tail = cjk[i + 1];

    if (head && tail) {
      bigrams.push(head + tail);
    }
  }

  return [...latin, ...cjk, ...bigrams];
};

// 这里用 djb2 把 token 映射到固定维度的桶，保证可复现且无外部依赖。
const hashToken = (token: string): number => {
  let hash = 5381;

  for (const ch of token) {
    hash = ((hash * 33) ^ ch.charCodeAt(0)) >>> 0;
  }

  return hash;
};

export const deterministicEmbedding = (text: string): number[] => {
  const vector = new Float64Array(DIM);

  for (const token of tokenize(text)) {
    const bucket = hashToken(token) % DIM;
    vector[bucket] = (vector[bucket] ?? 0) + 1;
  }

  let norm = 0;

  for (const value of vector) {
    norm += value * value;
  }

  norm = Math.sqrt(norm) || 1;

  return Array.from(vector, (value) => value / norm);
};

// 这里计算余弦相似度（输入已 L2 归一化，点积即余弦）。
export const cosineSimilarity = (a: number[], b: number[]): number => {
  const length = Math.min(a.length, b.length);
  let dot = 0;

  for (let i = 0; i < length; i += 1) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }

  return dot;
};

// 这里提供轻量分词，供词面/term 通道做包含匹配（lexical 兜底信号）。
export const queryTokens = (text: string): string[] => {
  const lower = text.toLowerCase();
  const latin = lower.match(/[a-z0-9]{2,}/g) ?? [];
  const cjk = lower.match(/[一-鿿]/g) ?? [];

  return [...new Set([...latin, ...cjk])];
};

export const containsAnyToken = (
  haystack: string,
  tokens: string[]
): boolean => {
  const lower = haystack.toLowerCase();

  return tokens.some((token) => lower.includes(token));
};
