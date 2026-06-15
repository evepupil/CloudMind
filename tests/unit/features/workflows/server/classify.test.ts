import { describe, expect, it } from "vitest";

import type { AssetDetail } from "@/features/assets/model/types";
import { classifyAsset } from "@/features/workflows/server/classify";

// 构造一个最小 note 资产，仅用于驱动启发式分类器（其余字段不参与判定）。
const createAsset = (overrides: Partial<AssetDetail> = {}): AssetDetail => ({
  id: "asset-1",
  type: "note",
  title: "记忆",
  summary: null,
  sourceUrl: null,
  sourceKind: "mcp",
  status: "processing",
  domain: "general",
  aiVisibility: "allow",
  retrievalPriority: 0,
  scopeId: "personal",
  sourceHost: null,
  collectionKey: null,
  capturedAt: "2026-06-07T00:00:00.000Z",
  createdAt: "2026-06-07T00:00:00.000Z",
  updatedAt: "2026-06-07T00:00:00.000Z",
  contentText: null,
  rawR2Key: null,
  contentR2Key: null,
  mimeType: "text/plain",
  language: null,
  errorMessage: null,
  processedAt: null,
  failedAt: null,
  source: null,
  jobs: [],
  chunks: [],
  ...overrides,
});

describe("classifyAsset — Chinese sensitive content gating", () => {
  it("gates a Chinese finance memory to summary_only via the finance domain", () => {
    const result = classifyAsset({
      asset: createAsset({ title: "财务状况" }),
      normalizedContent:
        "用户年收入约 50 万人民币，名下有一套按揭中的房产，另有约 80 万现金储蓄。",
    });

    expect(result.domain).toBe("finance");
    expect(result.aiVisibility).toBe("summary_only");
  });

  it("denies Chinese credential content outright", () => {
    const result = classifyAsset({
      asset: createAsset({ title: "账号" }),
      normalizedContent: "我的登录密码是 hunter2，钱包助记词请勿外泄。",
    });

    expect(result.aiVisibility).toBe("deny");
  });

  it("gates a Chinese diary to summary_only via the personal domain", () => {
    const result = classifyAsset({
      asset: createAsset({ title: "今天的日记" }),
      normalizedContent: "今天的日记：和家人去旅行，记录一些回忆。",
    });

    expect(result.domain).toBe("personal");
    expect(result.aiVisibility).toBe("summary_only");
  });

  it("keeps a non-sensitive Chinese engineering note fully visible", () => {
    const result = classifyAsset({
      asset: createAsset({ title: "编程偏好" }),
      normalizedContent:
        "用户的编程偏好：typescript strict、2 空格缩进、函数式优先。",
    });

    expect(result.aiVisibility).toBe("allow");
  });
});
