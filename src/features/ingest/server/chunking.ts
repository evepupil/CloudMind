const normalizeChunkText = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

const createTextPreview = (value: string): string => {
  const normalized = normalizeChunkText(value);

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177)}...`;
};

const findChunkBoundary = (
  value: string,
  start: number,
  end: number
): number => {
  if (end >= value.length) {
    return value.length;
  }

  const boundary = value.lastIndexOf("\n", end);

  if (boundary > start + 200) {
    return boundary;
  }

  const spaceBoundary = value.lastIndexOf(" ", end);

  if (spaceBoundary > start + 200) {
    return spaceBoundary;
  }

  return end;
};

// 这里实现最小切块策略，优先按换行或空格断开，避免硬截断阅读体验过差。
export const chunkAssetContent = (
  value: string,
  options?: {
    chunkSize?: number;
    overlap?: number;
  }
): Array<{
  chunkIndex: number;
  text: string;
  textPreview: string;
}> => {
  const content = value.trim();

  if (!content) {
    return [];
  }

  const chunkSize = options?.chunkSize ?? 1000;
  const overlap = options?.overlap ?? 150;
  const chunks: Array<{
    chunkIndex: number;
    text: string;
    textPreview: string;
  }> = [];
  let cursor = 0;

  while (cursor < content.length) {
    const proposedEnd = Math.min(cursor + chunkSize, content.length);
    const chunkEnd = findChunkBoundary(content, cursor, proposedEnd);
    const chunkText = content.slice(cursor, chunkEnd).trim();

    if (!chunkText) {
      break;
    }

    chunks.push({
      chunkIndex: chunks.length,
      text: chunkText,
      textPreview: createTextPreview(chunkText),
    });

    if (chunkEnd >= content.length) {
      break;
    }

    cursor = Math.max(chunkEnd - overlap, cursor + 1);
  }

  return chunks;
};
