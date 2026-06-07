export interface WebPageFetchResult {
  title: string | null;
  sourceUrl: string;
  rawContent: string;
  content: string;
  fetchedAt: string;
  provider: "jina_reader";
}

// 这里抽象网页抓取边界，避免 workflow 直接依赖具体第三方抓取实现。
export interface WebPageFetcher {
  fetchUrl(url: string): Promise<WebPageFetchResult>;
  // 从已存档的原始抓取响应纯函数重建结构化结果（不发任何网络请求）。
  // 用于 reprocess：从不可变的 L1 原始快照重算下游，绝不重抓覆盖原始。
  // fallbackSourceUrl 在存档未含来源时兜底；fetchedAt 因无法从存档可靠还原而留空。
  parseArchived(
    rawContent: string,
    fallbackSourceUrl: string
  ): WebPageFetchResult;
}
