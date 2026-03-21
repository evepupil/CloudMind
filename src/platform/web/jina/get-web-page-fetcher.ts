import type { WebPageFetcher } from "@/core/web/ports";
import type { AppBindings } from "@/env";

import { JinaReaderWebPageFetcher } from "./jina-reader-fetcher";

// 这里集中解析网页抓取适配器；默认走 Jina Reader，无 key 时也可用受限速率模式。
export const getWebPageFetcherFromBindings = (
  bindings: AppBindings | undefined
): WebPageFetcher => {
  return new JinaReaderWebPageFetcher(bindings?.JINA_API_KEY);
};
