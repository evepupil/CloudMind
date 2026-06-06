// 这里把用户查询转成 FTS5 MATCH 表达式（供 trigram 全文索引使用）。
// 规则：
//   - 按空白切分；每段双引号转义后作为短语（trigram 子串匹配），用 OR 连接；
//   - 过滤掉长度 < 3 的段——FTS5 trigram 至少需要 3 个字符才能匹配（中文 2 字词无法命中，交给语义通道）；
//   - 没有可匹配段时返回 null，调用方据此跳过 lexical 通道。
export const FTS_TRIGRAM_MIN_CHARS = 3;

export const buildFtsMatchQuery = (query: string): string | null => {
  const parts = query
    .trim()
    .split(/\s+/)
    .map((part) => part.trim().replace(/"/g, '""'))
    .filter((part) => part.length >= FTS_TRIGRAM_MIN_CHARS);

  if (parts.length === 0) {
    return null;
  }

  return parts.map((part) => `"${part}"`).join(" OR ");
};
