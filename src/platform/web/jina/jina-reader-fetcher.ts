import type { WebPageFetchResult, WebPageFetcher } from "@/core/web/ports";

const JINA_READER_BASE_URL = "https://r.jina.ai";

const buildReaderUrl = (url: string): string => {
  const normalizedUrl = new URL(url);
  const targetPath = `${normalizedUrl.host}${normalizedUrl.pathname}${normalizedUrl.search}`;

  return `${JINA_READER_BASE_URL}/http://${targetPath}`;
};

const extractMetadataValue = (
  rawContent: string,
  label: "Title" | "URL Source"
): string | null => {
  const match = rawContent.match(
    new RegExp(`^${label}:\\s*(.+)$`, "im")
  );

  return match?.[1]?.trim() || null;
};

const extractMarkdownContent = (rawContent: string): string => {
  const match = rawContent.match(/(?:^|\n)Markdown Content:\s*\n?([\s\S]*)$/i);

  if (match?.[1]?.trim()) {
    return match[1].trim();
  }

  return rawContent.trim();
};

const extractHeadingTitle = (content: string): string | null => {
  const headingMatch = content.match(/^#\s+(.+)$/m);

  return headingMatch?.[1]?.trim() || null;
};

// 这里封装 Jina Reader 抓取实现；优先复用其网页转 Markdown 能力，而不是自己维护爬虫。
export class JinaReaderWebPageFetcher implements WebPageFetcher {
  public constructor(
    private readonly apiKey?: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  public async fetchUrl(url: string): Promise<WebPageFetchResult> {
    const response = await this.fetchImpl(buildReaderUrl(url), {
      headers: {
        Accept: "text/plain; charset=utf-8",
        ...(this.apiKey
          ? {
              Authorization: `Bearer ${this.apiKey}`,
            }
          : {}),
      },
    });

    if (!response.ok) {
      throw new Error(
        `Jina Reader request failed with status ${response.status}.`
      );
    }

    const rawContent = (await response.text()).trim();

    if (!rawContent) {
      throw new Error("Jina Reader returned empty content.");
    }

    const content = extractMarkdownContent(rawContent);

    if (!content) {
      throw new Error("Jina Reader returned empty markdown content.");
    }

    const sourceUrl = extractMetadataValue(rawContent, "URL Source") ?? url;
    const title =
      extractMetadataValue(rawContent, "Title") ?? extractHeadingTitle(content);

    return {
      title,
      sourceUrl,
      rawContent,
      content,
      fetchedAt: new Date().toISOString(),
      provider: "jina_reader",
    };
  }
}
