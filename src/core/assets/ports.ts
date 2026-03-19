import type {
  AssetChunkMatch,
  AssetDetail,
  AssetListQuery,
  AssetListResult,
} from "@/features/assets/model/types";

export interface CreateTextAssetInput {
  title?: string | undefined;
  content: string;
}

export interface CreateUrlAssetInput {
  title?: string | undefined;
  url: string;
}

export interface CreateFileAssetInput {
  id: string;
  title?: string | undefined;
  fileName: string;
  fileSize: number;
  mimeType: string;
  rawR2Key: string;
}

export interface AssetSearchInput {
  query: string;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface CompleteAssetProcessingInput {
  summary: string;
  contentText?: string | null;
  contentR2Key?: string | null;
}

export interface CreateAssetChunkInput {
  chunkIndex: number;
  textPreview: string;
  contentText: string;
  vectorId?: string | null;
}

// 这里定义资产读取侧接口，供列表与详情等读模型复用。
export interface AssetQueryRepository {
  listAssets(query?: AssetListQuery): Promise<AssetListResult>;
  getAssetById(id: string): Promise<AssetDetail>;
}

// 这里单独抽出搜索端口，避免未来把语义检索继续堆进列表接口。
export interface AssetSearchRepository {
  searchAssets(input: AssetSearchInput): Promise<AssetListResult>;
  getChunkMatchesByVectorIds(vectorIds: string[]): Promise<AssetChunkMatch[]>;
}

// 这里保留采集与处理链路需要的写侧接口。
export interface AssetIngestRepository {
  getAssetById(id: string): Promise<AssetDetail>;
  listAssetIdsMissingChunkContent(limit?: number): Promise<string[]>;
  createTextAsset(input: CreateTextAssetInput): Promise<AssetDetail>;
  createUrlAsset(input: CreateUrlAssetInput): Promise<AssetDetail>;
  createFileAsset(input: CreateFileAssetInput): Promise<AssetDetail>;
  markAssetProcessing(id: string): Promise<void>;
  completeAssetProcessing(
    id: string,
    input: CompleteAssetProcessingInput
  ): Promise<void>;
  replaceAssetChunks(
    assetId: string,
    chunks: CreateAssetChunkInput[]
  ): Promise<void>;
  failAssetProcessing(id: string, message: string): Promise<void>;
  markIngestJobRunning(jobId: string): Promise<void>;
  completeIngestJob(jobId: string): Promise<void>;
  failIngestJob(jobId: string, message: string): Promise<void>;
}

export type AssetRepository = AssetQueryRepository &
  AssetSearchRepository &
  AssetIngestRepository;
