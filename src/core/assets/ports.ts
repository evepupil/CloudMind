import type {
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

// 这里定义资产领域侧的持久化端口，避免 feature 直接绑定 D1 细节。
export interface AssetRepository {
  listAssets(query?: AssetListQuery): Promise<AssetListResult>;
  getAssetById(id: string): Promise<AssetDetail>;
  createTextAsset(input: CreateTextAssetInput): Promise<AssetDetail>;
  createUrlAsset(input: CreateUrlAssetInput): Promise<AssetDetail>;
  createFileAsset(input: CreateFileAssetInput): Promise<AssetDetail>;
  markAssetProcessing(id: string): Promise<void>;
  completeAssetProcessing(
    id: string,
    summary: string,
    contentText?: string | null
  ): Promise<void>;
  failAssetProcessing(id: string, message: string): Promise<void>;
  markIngestJobRunning(jobId: string): Promise<void>;
  completeIngestJob(jobId: string): Promise<void>;
  failIngestJob(jobId: string, message: string): Promise<void>;
}
