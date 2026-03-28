import { renderToString } from "hono/jsx/dom/server";
import { describe, expect, it } from "vitest";

import type { AssetDetail } from "@/features/assets/model/types";
import { AssetWorkflowsPage } from "@/features/workflows/components/asset-workflows-page";
import type { WorkflowRunDetail } from "@/features/workflows/model/types";

const createAssetDetail = (
  overrides: Partial<AssetDetail> = {}
): AssetDetail => {
  return {
    id: "asset-1",
    type: "note",
    title: "CloudMind architecture notes",
    summary: "Layered indexing plan",
    sourceUrl: null,
    sourceKind: "manual",
    status: "ready",
    domain: "engineering",
    sensitivity: "internal",
    aiVisibility: "allow",
    retrievalPriority: 0,
    documentClass: "design_doc",
    sourceHost: "github.com",
    collectionKey: "cloudmind/notes",
    capturedAt: "2026-03-28T10:00:00.000Z",
    descriptorJson: null,
    createdAt: "2026-03-28T10:00:00.000Z",
    updatedAt: "2026-03-28T10:10:00.000Z",
    contentText: "CloudMind keeps workflow inspection outside the detail page.",
    rawR2Key: null,
    contentR2Key: null,
    mimeType: "text/plain",
    language: "zh",
    errorMessage: null,
    processedAt: "2026-03-28T10:10:00.000Z",
    failedAt: null,
    source: {
      kind: "manual",
      sourceUrl: null,
      metadataJson: null,
      createdAt: "2026-03-28T10:00:00.000Z",
    },
    jobs: [],
    chunks: [],
    facets: [],
    assertions: [],
    ...overrides,
  };
};

const workflowDetail: WorkflowRunDetail = {
  run: {
    id: "run-1",
    assetId: "asset-1",
    workflowType: "note_ingest_v1",
    triggerType: "reprocess",
    status: "succeeded",
    stateJson: '{"summary":"done","chunkCount":4}',
    currentStep: null,
    errorMessage: null,
    startedAt: "2026-03-28T10:01:00.000Z",
    finishedAt: "2026-03-28T10:02:30.000Z",
    createdAt: "2026-03-28T10:00:30.000Z",
    updatedAt: "2026-03-28T10:02:30.000Z",
  },
  steps: [
    {
      id: "step-1",
      runId: "run-1",
      assetId: "asset-1",
      stepKey: "derive_facets",
      stepType: "derive_facets",
      status: "succeeded",
      attempt: 1,
      inputJson: null,
      outputJson: '{"facetCount":6}',
      errorMessage: null,
      startedAt: "2026-03-28T10:01:20.000Z",
      finishedAt: "2026-03-28T10:01:30.000Z",
      createdAt: "2026-03-28T10:00:30.000Z",
      updatedAt: "2026-03-28T10:01:30.000Z",
    },
    {
      id: "step-2",
      runId: "run-1",
      assetId: "asset-1",
      stepKey: "embed",
      stepType: "embed",
      status: "succeeded",
      attempt: 1,
      inputJson: null,
      outputJson: '{"vectorCount":4}',
      errorMessage: null,
      startedAt: "2026-03-28T10:01:40.000Z",
      finishedAt: "2026-03-28T10:02:05.000Z",
      createdAt: "2026-03-28T10:00:30.000Z",
      updatedAt: "2026-03-28T10:02:05.000Z",
    },
  ],
  artifacts: [
    {
      id: "artifact-1",
      assetId: "asset-1",
      artifactType: "summary",
      version: 1,
      storageKind: "inline",
      r2Key: null,
      contentText: "Workflow inspection should live on its own page.",
      metadataJson: '{"model":"cf/qwen"}',
      createdByRunId: "run-1",
      createdAt: "2026-03-28T10:01:10.000Z",
    },
  ],
};

describe("AssetWorkflowsPage", () => {
  it("renders tab navigation and selected workflow detail", () => {
    const html = renderToString(
      <AssetWorkflowsPage
        item={createAssetDetail()}
        runs={[workflowDetail.run]}
        selectedRun={workflowDetail}
      />
    );

    expect(html).toContain("Workflow Inspection");
    expect(html).toContain('href="/assets/asset-1"');
    expect(html).toContain('href="/assets/asset-1/workflows"');
    expect(html).toContain("Derive Facets");
    expect(html).toContain("artifact-1");
    expect(html).toContain("Workflow inspection should live on its own page.");
  });

  it("renders an empty state when no workflow runs exist", () => {
    const html = renderToString(
      <AssetWorkflowsPage item={createAssetDetail()} runs={[]} />
    );

    expect(html).toContain(
      "No workflow runs have been created for this asset yet."
    );
  });
});
