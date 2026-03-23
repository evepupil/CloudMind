import type {
  AssetAiVisibility,
  AssetAssertionKind,
  AssetAssertionMatch,
  AssetDocumentClass,
  AssetChunkMatch,
  AssetDetail,
  AssetDomain,
  AssetFacetKey,
  AssetListQuery,
  AssetListResult,
  AssetSensitivity,
  AssetSourceKind,
  AssetSummaryMatch,
} from "@/features/assets/model/types";
import type { TextAssetEnrichmentInput } from "@/features/ingest/model/enrichment";

export interface CreateTextAssetInput {
  title?: string | undefined;
  content: string;
  sourceKind?: AssetSourceKind | undefined;
  enrichment?: TextAssetEnrichmentInput | undefined;
}

export interface CreateUrlAssetInput {
  title?: string | undefined;
  url: string;
  sourceKind?: AssetSourceKind | undefined;
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

export interface ChunkMatchQuery {
  aiVisibility?: AssetAiVisibility[] | undefined;
}

export interface SearchAssetSummaryInput {
  query: string;
  limit: number;
  aiVisibility: AssetAiVisibility[];
}

export interface SearchAssetAssertionInput {
  query: string;
  limit: number;
  aiVisibility: AssetAiVisibility[];
}

export interface CompleteAssetProcessingInput {
  summary: string;
  contentText?: string | null;
  rawR2Key?: string | null;
  contentR2Key?: string | null;
}

export interface CreateAssetChunkInput {
  chunkIndex: number;
  textPreview: string;
  contentText: string;
  vectorId?: string | null;
}

export interface CreateAssetFacetInput {
  facetKey: AssetFacetKey;
  facetValue: string;
  facetLabel: string;
  sortOrder?: number | undefined;
}

export interface CreateAssetAssertionInput {
  assertionIndex: number;
  kind: AssetAssertionKind;
  text: string;
  sourceChunkIndex?: number | null | undefined;
  sourceSpanJson?: string | null | undefined;
  confidence?: number | null | undefined;
}

export interface UpdateAssetMetadataInput {
  title?: string | undefined;
  summary?: string | null | undefined;
  sourceUrl?: string | null | undefined;
}

export interface UpdateAssetIndexingInput {
  sourceKind?: AssetSourceKind | null | undefined;
  domain?: AssetDomain | undefined;
  sensitivity?: AssetSensitivity | undefined;
  aiVisibility?: AssetAiVisibility | undefined;
  retrievalPriority?: number | undefined;
  documentClass?: AssetDocumentClass | null | undefined;
  sourceHost?: string | null | undefined;
  collectionKey?: string | null | undefined;
  capturedAt?: string | null | undefined;
  descriptorJson?: string | null | undefined;
}

// 这里定义资产读取侧接口，供列表与详情等读模型复用。
export interface AssetQueryRepository {
  listAssets(query?: AssetListQuery): Promise<AssetListResult>;
  getAssetById(id: string): Promise<AssetDetail>;
}

// 这里单独抽出搜索端口，避免未来把语义检索继续堆进列表接口。
export interface AssetSearchRepository {
  searchAssets(input: AssetSearchInput): Promise<AssetListResult>;
  getChunkMatchesByVectorIds(
    vectorIds: string[],
    query?: ChunkMatchQuery
  ): Promise<AssetChunkMatch[]>;
  searchAssetSummaries(
    input: SearchAssetSummaryInput
  ): Promise<AssetSummaryMatch[]>;
  searchAssetAssertions?(
    input: SearchAssetAssertionInput
  ): Promise<AssetAssertionMatch[]>;
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
  replaceAssetFacets?(
    assetId: string,
    facets: CreateAssetFacetInput[]
  ): Promise<void>;
  replaceAssetAssertions?(
    assetId: string,
    assertions: CreateAssetAssertionInput[]
  ): Promise<void>;
  updateAssetIndexing(
    id: string,
    input: UpdateAssetIndexingInput
  ): Promise<void>;
  failAssetProcessing(id: string, message: string): Promise<void>;
  markIngestJobRunning(jobId: string): Promise<void>;
  completeIngestJob(jobId: string): Promise<void>;
  failIngestJob(jobId: string, message: string): Promise<void>;
  updateAssetMetadata(
    id: string,
    input: UpdateAssetMetadataInput
  ): Promise<AssetDetail>;
}

// 这里补充资产管理写侧接口，承接人工编辑与软删除场景。
export interface AssetMutationRepository {
  updateAssetMetadata(
    id: string,
    input: UpdateAssetMetadataInput
  ): Promise<AssetDetail>;
  softDeleteAsset(id: string): Promise<void>;
}

export type AssetRepository = AssetQueryRepository &
  AssetSearchRepository &
  AssetIngestRepository &
  AssetMutationRepository;
