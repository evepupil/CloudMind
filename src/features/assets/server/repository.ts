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

export interface AssetRepository {
  listAssets(query?: AssetListQuery): Promise<AssetListResult>;
  getAssetById(id: string): Promise<AssetDetail>;
  createTextAsset(input: CreateTextAssetInput): Promise<AssetDetail>;
  createUrlAsset(input: CreateUrlAssetInput): Promise<AssetDetail>;
  createFileAsset(input: CreateFileAssetInput): Promise<AssetDetail>;
  markAssetProcessing(id: string): Promise<void>;
  completeAssetProcessing(id: string, summary: string): Promise<void>;
  failAssetProcessing(id: string, message: string): Promise<void>;
  markIngestJobRunning(jobId: string): Promise<void>;
  completeIngestJob(jobId: string): Promise<void>;
  failIngestJob(jobId: string, message: string): Promise<void>;
}

// 这里用显式错误区分“数据不存在”和“系统配置缺失”，便于路由层返回稳定状态码。
export class AssetNotFoundError extends Error {
  public constructor(id: string) {
    super(`Asset "${id}" was not found.`);
    this.name = "AssetNotFoundError";
  }
}
