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
}
