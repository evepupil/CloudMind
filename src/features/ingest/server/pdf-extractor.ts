import { extractText, getDocumentProxy } from "unpdf";

const normalizeExtractedText = (value: string): string => {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

// 这里封装 PDF 文本提取，避免处理器直接耦合第三方库细节。
export const extractPdfText = async (
  body: ArrayBuffer
): Promise<{
  totalPages: number;
  text: string;
}> => {
  const pdf = await getDocumentProxy(new Uint8Array(body));
  const result = await extractText(pdf, {
    mergePages: true,
  });

  return {
    totalPages: result.totalPages,
    text: normalizeExtractedText(result.text),
  };
};
