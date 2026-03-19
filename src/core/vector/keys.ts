// 这里统一 chunk 对应的向量 ID 规则，避免重处理时生成漂移的标识。
export const createChunkVectorId = (
  assetId: string,
  chunkIndex: number
): string => {
  return `${assetId}:${chunkIndex}`;
};
