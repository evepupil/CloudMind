import type { AssetType } from "@/features/assets/model/types";

export interface ChunkAssetContentOptions {
  assetType?: AssetType | undefined;
  chunkTokens?: number | undefined;
  overlapTokens?: number | undefined;
}

export interface PreparedChunkSegment {
  chunkIndex: number;
  text: string;
  textPreview: string;
}

const DEFAULT_CHUNK_TOKENS = 400;
const PREVIEW_MAX_CHARS = 180;
const CJK_PATTERN = /[一-鿿]/g;

// 这里给不同资产类型设定默认 token 预算：CJK 笔记密度高、PDF 长文可放宽。
const TOKEN_BUDGET_BY_TYPE: Partial<Record<AssetType, number>> = {
  note: 350,
  chat: 300,
  pdf: 450,
  url: 400,
  image: 350,
};

// 这里估算 token 数：CJK 字符约 1 token/字，其余按 ~4 字符/token 近似，兼顾中英文密度差异。
const estimateTokens = (text: string): number => {
  const cjk = (text.match(CJK_PATTERN) ?? []).length;
  const rest = text.length - cjk;

  return cjk + Math.ceil(Math.max(rest, 0) / 4);
};

// 这里生成预览：压平空白并截断，仅用于展示，不参与切块/嵌入。
const createChunkPreview = (text: string): string => {
  const flattened = text.replace(/\s+/g, " ").trim();

  if (flattened.length <= PREVIEW_MAX_CHARS) {
    return flattened;
  }

  return `${flattened.slice(0, PREVIEW_MAX_CHARS - 3)}...`;
};

const isHeadingLine = (line: string): boolean => /^#{1,6}\s+/.test(line);
const isListLine = (line: string): boolean =>
  /^(?:[-*+]\s+|\d+[.)]\s+)/.test(line);

// 这里把文本切成结构单元：空行分段，标题行/列表项各自成单元，保留结构边界。
const splitStructuralUnits = (content: string): string[] => {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const units: string[] = [];
  let buffer: string[] = [];

  const flush = (): void => {
    if (buffer.length > 0) {
      const joined = buffer.join("\n").trim();

      if (joined) {
        units.push(joined);
      }

      buffer = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === "") {
      flush();
      continue;
    }

    if (isHeadingLine(line) || isListLine(line)) {
      flush();
      units.push(line);
      continue;
    }

    buffer.push(line);
  }

  flush();

  return units;
};

// 这里做句子级切分：在句末标点或换行处断开，供超预算单元降级与重叠衔接使用。
const splitSentences = (text: string): string[] => {
  return text
    .split(/(?<=[.!?。！？；;])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
};

// 这里兜底硬切：单句仍超预算时按词、再按字符切到预算内（覆盖无空格的 CJK 长句）。
const hardSplit = (text: string, budget: number): string[] => {
  const pieces: string[] = [];
  let buffer = "";

  for (const word of text.split(/(\s+)/)) {
    if (buffer.trim() && estimateTokens(buffer + word) > budget) {
      pieces.push(buffer.trim());
      buffer = "";
    }

    buffer += word;
  }

  if (buffer.trim()) {
    pieces.push(buffer.trim());
  }

  const result: string[] = [];

  for (const piece of pieces) {
    if (estimateTokens(piece) <= budget) {
      result.push(piece);
      continue;
    }

    let chars = "";

    for (const ch of piece) {
      chars += ch;

      if (estimateTokens(chars) >= budget) {
        result.push(chars);
        chars = "";
      }
    }

    if (chars) {
      result.push(chars);
    }
  }

  return result;
};

// 这里把结构单元降级为不超预算的 segment 序列。
const toSegments = (units: string[], budget: number): string[] => {
  const segments: string[] = [];

  for (const unit of units) {
    if (estimateTokens(unit) <= budget) {
      segments.push(unit);
      continue;
    }

    for (const sentence of splitSentences(unit)) {
      if (estimateTokens(sentence) <= budget) {
        segments.push(sentence);
      } else {
        segments.push(...hardSplit(sentence, budget));
      }
    }
  }

  return segments;
};

const resolveChunkTokens = (options?: ChunkAssetContentOptions): number => {
  if (options?.chunkTokens && options.chunkTokens > 0) {
    return options.chunkTokens;
  }

  if (options?.assetType) {
    return TOKEN_BUDGET_BY_TYPE[options.assetType] ?? DEFAULT_CHUNK_TOKENS;
  }

  return DEFAULT_CHUNK_TOKENS;
};

// 这里实现结构 + token 感知的切块：先按标题/段落/列表/句子切，再按 token 预算打包并做句子安全重叠。
// 取代旧的字符定长窗口（会在句子中间硬切、且依赖已被压平的换行）。
export const chunkAssetContent = (
  value: string,
  options?: ChunkAssetContentOptions
): PreparedChunkSegment[] => {
  const content = value.trim();

  if (!content) {
    return [];
  }

  const budget = resolveChunkTokens(options);
  const overlap =
    options?.overlapTokens !== undefined && options.overlapTokens >= 0
      ? options.overlapTokens
      : Math.round(budget * 0.15);
  const segments = toSegments(splitStructuralUnits(content), budget);
  const chunks: PreparedChunkSegment[] = [];

  let current: string[] = [];
  let currentTokens = 0;

  const pushChunk = (): void => {
    const text = current.join("\n").trim();

    if (text) {
      chunks.push({
        chunkIndex: chunks.length,
        text,
        textPreview: createChunkPreview(text),
      });
    }
  };

  for (const segment of segments) {
    const segmentTokens = estimateTokens(segment);

    if (currentTokens > 0 && currentTokens + segmentTokens > budget) {
      pushChunk();

      // 句子安全重叠：从上一窗口尾部回收若干完整 segment 作为衔接（overlap=0 则不回收）。
      const carried: string[] = [];
      let carriedTokens = 0;

      if (overlap > 0) {
        for (let i = current.length - 1; i >= 0; i -= 1) {
          const previous = current[i];

          if (!previous) {
            continue;
          }

          const previousTokens = estimateTokens(previous);

          if (carriedTokens + previousTokens > overlap) {
            break;
          }

          carried.unshift(previous);
          carriedTokens += previousTokens;
        }
      }

      current = [...carried];
      currentTokens = carriedTokens;
    }

    current.push(segment);
    currentTokens += segmentTokens;
  }

  pushChunk();

  return chunks;
};
