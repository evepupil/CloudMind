export interface MixedTokenizerOptions {
  minLatinTokenLength?: number;
  stopWords?: ReadonlySet<string>;
}

const CJK_SEQUENCE_PATTERN = /[\u3400-\u9fff]+/g;

const tokenizeCjkSequence = (value: string): string[] => {
  if (value.length <= 2) {
    return [value];
  }

  const tokens: string[] = [];

  for (let index = 0; index < value.length - 1; index += 1) {
    tokens.push(value.slice(index, index + 2));
  }

  return tokens;
};

// 拉丁词按连续字符读取，CJK 连续文本按相邻双字切分，兼容中英文混合查询。
export const tokenizeMixedText = (
  value: string,
  options: MixedTokenizerOptions = {}
): string[] => {
  const normalized = value.toLowerCase();
  const minLatinTokenLength = options.minLatinTokenLength ?? 2;
  const stopWords = options.stopWords;
  const latinTokens = Array.from(normalized.matchAll(/[a-z0-9_]+/g))
    .map((match) => match[0])
    .filter(
      (token) => token.length >= minLatinTokenLength && !stopWords?.has(token)
    );
  const cjkTokens = Array.from(
    normalized.matchAll(CJK_SEQUENCE_PATTERN)
  ).flatMap((match) => tokenizeCjkSequence(match[0]));

  return [...latinTokens, ...cjkTokens];
};
