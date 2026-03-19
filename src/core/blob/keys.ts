const sanitizeFileName = (fileName: string): string => {
  const normalized = fileName.trim().replace(/\s+/g, "-").toLowerCase();

  return normalized.replace(/[^a-z0-9._-]/g, "");
};

// 这里统一生成原始资产对象 key，避免上层重复拼接存储路径。
export const createRawAssetBlobKey = (
  assetId: string,
  fileName: string
): string => {
  const safeFileName = sanitizeFileName(fileName) || "upload.bin";

  return `assets/${assetId}/raw/${safeFileName}`;
};

// 这里统一生成清洗后正文的对象 key，避免处理器重复拼接路径。
export const createProcessedContentBlobKey = (
  assetId: string,
  extension = "txt"
): string => {
  const safeExtension =
    extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "txt";

  return `assets/${assetId}/content/content.${safeExtension}`;
};
