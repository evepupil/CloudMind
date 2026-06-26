import { AssetPageActions } from "@/features/assets/components/asset-page-actions";
import { AssetTabs } from "@/features/assets/components/asset-tabs";
import type { AssetDetail } from "@/features/assets/model/types";
import { PageShell } from "@/features/layout/components/page-shell";
import {
  FlashMessage,
  Panel,
  StatusBadge,
  type StatusKind,
} from "@/features/ui/components";
import type {
  AssetArtifactRecord,
  WorkflowRunDetail,
  WorkflowRunRecord,
  WorkflowRunStatus,
  WorkflowStepRecord,
  WorkflowStepStatus,
} from "@/features/workflows/model/types";

const formatDate = (value: string | null): string => {
  if (!value) {
    return "N/A";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
};

const formatDuration = (
  startedAt: string | null,
  finishedAt: string | null
): string => {
  if (!startedAt || !finishedAt) {
    return "N/A";
  }
  const durationMs =
    new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "N/A";
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`;
};

const formatLabel = (value: string): string =>
  value
    .split("_")
    .map((segment) =>
      segment.length > 0
        ? `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`
        : segment
    )
    .join(" ");

const formatJsonPreview = (
  value: string | null,
  limit = 600
): string | null => {
  if (!value) {
    return null;
  }
  let preview = value;
  try {
    preview = JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    // 不是合法 JSON，保持原始字符串用于预览
  }
  if (preview.length <= limit) {
    return preview;
  }
  return `${preview.slice(0, limit).trimEnd()}\n...`;
};

// 工作流/步骤状态 → StatusBadge 的四态语义映射。
const runStatusKind = (status: WorkflowRunStatus): StatusKind => {
  switch (status) {
    case "succeeded":
      return "ready";
    case "failed":
      return "failed";
    case "running":
      return "processing";
    default:
      return "pending";
  }
};

const stepStatusKind = (status: WorkflowStepStatus): StatusKind => {
  switch (status) {
    case "succeeded":
      return "ready";
    case "failed":
      return "failed";
    case "running":
      return "processing";
    default:
      return "pending";
  }
};

const buildRunHref = (assetId: string, runId: string): string =>
  `/assets/${assetId}/workflows?runId=${encodeURIComponent(runId)}`;

// 等宽预览块（JSON / 正文片段）。
const CodeBlock = ({ children }: { children: string }) => (
  <pre class="m-0 whitespace-pre-wrap break-words rounded-md border border-line bg-ink-raised p-3 font-mono text-[13px] leading-[1.7] text-bone-soft">
    {children}
  </pre>
);

// 小元数据格子。
const MetaCell = ({ label, value }: { label: string; value: string }) => (
  <div class="rounded-md border border-line bg-ink-raised px-4 py-3">
    <div class="font-mono text-[10.5px] uppercase tracking-[0.1em] text-bone-faint">
      {label}
    </div>
    <div class="mt-1.5 break-words text-[14px] font-medium text-bone">
      {value}
    </div>
  </div>
);

const renderArtifactBody = (artifact: AssetArtifactRecord) => {
  const contentPreview = artifact.contentText?.trim()
    ? artifact.contentText.trim().slice(0, 400)
    : null;
  const metadataPreview = formatJsonPreview(artifact.metadataJson, 320);

  return (
    <div class="grid gap-2.5">
      <div class="font-mono text-[12px] text-bone-faint">
        创建于 {formatDate(artifact.createdAt)}
      </div>
      {artifact.r2Key ? (
        <div class="rounded-md border border-line bg-ink-raised px-3 py-2.5">
          <div class="font-mono text-[10.5px] uppercase tracking-[0.1em] text-bone-faint">
            R2 Key
          </div>
          <div class="mt-1.5 break-words font-mono text-[13px] text-bone">
            {artifact.r2Key}
          </div>
        </div>
      ) : null}
      {contentPreview ? <CodeBlock>{contentPreview}</CodeBlock> : null}
      {metadataPreview ? <CodeBlock>{metadataPreview}</CodeBlock> : null}
    </div>
  );
};

const StepCard = ({ step }: { step: WorkflowStepRecord }) => {
  const outputPreview = formatJsonPreview(step.outputJson, 480);

  return (
    <Panel class="p-5" variant="raised">
      <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="text-[15px] font-semibold text-bone">
            {formatLabel(step.stepKey)}
          </div>
          <div class="mt-1 font-mono text-[12px] text-bone-faint">
            {formatLabel(step.stepType)} · 第 {step.attempt} 次
          </div>
        </div>
        <StatusBadge status={stepStatusKind(step.status)} label={step.status} />
      </div>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <MetaCell label="开始" value={formatDate(step.startedAt)} />
        <MetaCell label="结束" value={formatDate(step.finishedAt)} />
        <MetaCell
          label="耗时"
          value={formatDuration(step.startedAt, step.finishedAt)}
        />
      </div>
      {step.errorMessage ? (
        <p class="mt-3 rounded-md border border-status-failed-border bg-status-failed-bg px-3 py-2.5 text-[13px] leading-[1.7] text-status-failed">
          {step.errorMessage}
        </p>
      ) : null}
      {outputPreview ? (
        <div class="mt-3">
          <CodeBlock>{outputPreview}</CodeBlock>
        </div>
      ) : null}
    </Panel>
  );
};

export const AssetWorkflowsPage = ({
  item,
  runs = [],
  selectedRun,
  selectedRunId,
  errorMessage,
}: {
  item?: AssetDetail | undefined;
  runs?: WorkflowRunRecord[] | undefined;
  selectedRun?: WorkflowRunDetail | null | undefined;
  selectedRunId?: string | undefined;
  errorMessage?: string | undefined;
}) => {
  if (!item) {
    return (
      <PageShell
        navigationKey="library"
        eyebrow="工作区 · 记忆库"
        title="工作流检视"
        subtitle="查看单条资产的工作流运行、步骤与生成产物。"
        actions={<AssetPageActions />}
      >
        <FlashMessage kind="error">
          {errorMessage ?? "未找到该资产。"}
        </FlashMessage>
      </PageShell>
    );
  }

  const latestRun = runs[0] ?? null;
  const activeRunId = selectedRun?.run.id ?? selectedRunId ?? latestRun?.id;
  const selectedArtifacts = selectedRun?.artifacts ?? [];
  const selectedSteps = selectedRun?.steps ?? [];
  const parsedState = formatJsonPreview(selectedRun?.run.stateJson ?? null);

  return (
    <PageShell
      navigationKey="library"
      eyebrow="工作区 · 记忆库 / 工作流"
      title={item.title}
      subtitle="在独立视图里检视工作流运行、步骤耗时与生成产物，不让详情页拥挤。"
      actions={<AssetPageActions assetId={item.id} />}
    >
      {errorMessage ? (
        <FlashMessage kind="error" class="mb-4">
          {errorMessage}
        </FlashMessage>
      ) : null}

      <AssetTabs assetId={item.id} activeTab="workflows" />

      {/* 计量条 */}
      <section class="mb-5 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-px overflow-hidden rounded-lg border border-line bg-line-soft">
        <div class="bg-ink-raised px-5 py-4">
          <div class="font-mono text-[10.5px] uppercase tracking-[0.1em] text-bone-faint">
            运行次数
          </div>
          <div class="mt-2 font-display text-[28px] font-medium tabular-nums text-bone">
            {runs.length}
          </div>
        </div>
        <div class="bg-ink-raised px-5 py-4">
          <div class="font-mono text-[10.5px] uppercase tracking-[0.1em] text-bone-faint">
            最新状态
          </div>
          <div class="mt-2.5">
            {latestRun ? (
              <StatusBadge
                status={runStatusKind(latestRun.status)}
                label={latestRun.status}
              />
            ) : (
              <span class="text-[14px] text-bone-soft">尚无运行</span>
            )}
          </div>
        </div>
        <div class="bg-ink-raised px-5 py-4">
          <div class="font-mono text-[10.5px] uppercase tracking-[0.1em] text-bone-faint">
            当前运行
          </div>
          <div class="mt-2 break-words font-mono text-[13px] font-medium text-bone">
            {activeRunId ?? "N/A"}
          </div>
        </div>
        <div class="bg-ink-raised px-5 py-4">
          <div class="font-mono text-[10.5px] uppercase tracking-[0.1em] text-bone-faint">
            选中产物
          </div>
          <div class="mt-2 font-display text-[28px] font-medium tabular-nums text-bone">
            {selectedArtifacts.length}
          </div>
        </div>
      </section>

      {runs.length === 0 ? (
        <Panel class="p-6" variant="panel">
          <p class="text-[14px] text-bone-soft">该资产尚无工作流运行记录。</p>
        </Panel>
      ) : (
        <section class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,0.62fr)_minmax(0,1.38fr)]">
          {/* 左：运行列表 */}
          <aside>
            <Panel class="p-5" variant="panel">
              <div class="mb-3 flex items-center justify-between gap-3">
                <h2 class="font-display text-[18px] font-semibold text-bone">
                  运行
                </h2>
                <span class="font-mono text-[11px] text-bone-faint">
                  最新在前
                </span>
              </div>
              <div class="flex flex-col gap-3">
                {runs.map((run) => {
                  const isActive = run.id === activeRunId;
                  return (
                    <a
                      key={run.id}
                      href={buildRunHref(item.id, run.id)}
                      class={`rounded-lg border p-4 no-underline transition-colors ${
                        isActive
                          ? "border-brass/50 bg-brass-soft"
                          : "border-line bg-ink-raised hover:border-brass/30"
                      }`}
                    >
                      <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div class="break-words text-[14.5px] font-semibold text-bone">
                            {formatLabel(run.workflowType)}
                          </div>
                          <div class="mt-1 font-mono text-[11px] text-bone-faint">
                            {formatLabel(run.triggerType)} ·{" "}
                            {formatDate(run.createdAt)}
                          </div>
                        </div>
                        <StatusBadge
                          status={runStatusKind(run.status)}
                          label={run.status}
                        />
                      </div>
                      <div class="mt-3 text-[12px] text-bone-soft">
                        当前步骤：{" "}
                        <span class="text-bone">
                          {run.currentStep
                            ? formatLabel(run.currentStep)
                            : "N/A"}
                        </span>
                      </div>
                      {run.errorMessage ? (
                        <p class="mt-2.5 text-[12px] leading-[1.7] text-status-failed">
                          {run.errorMessage}
                        </p>
                      ) : null}
                    </a>
                  );
                })}
              </div>
            </Panel>
          </aside>

          {/* 右：运行详情 */}
          <div class="flex flex-col gap-4">
            {selectedRun ? (
              <>
                <Panel class="p-6" variant="panel">
                  <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div class="font-mono text-[12px] text-bone-faint">
                        Run ID {selectedRun.run.id}
                      </div>
                      <h2 class="mt-1 font-display text-[22px] font-semibold text-bone">
                        {formatLabel(selectedRun.run.workflowType)}
                      </h2>
                    </div>
                    <StatusBadge
                      status={runStatusKind(selectedRun.run.status)}
                      label={selectedRun.run.status}
                    />
                  </div>
                  <div class="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
                    <MetaCell
                      label="触发"
                      value={formatLabel(selectedRun.run.triggerType)}
                    />
                    <MetaCell
                      label="当前步骤"
                      value={
                        selectedRun.run.currentStep
                          ? formatLabel(selectedRun.run.currentStep)
                          : "N/A"
                      }
                    />
                    <MetaCell
                      label="开始"
                      value={formatDate(selectedRun.run.startedAt)}
                    />
                    <MetaCell
                      label="结束"
                      value={formatDate(selectedRun.run.finishedAt)}
                    />
                  </div>
                  {selectedRun.run.errorMessage ? (
                    <p class="mt-4 rounded-md border border-status-failed-border bg-status-failed-bg px-4 py-3 text-[13px] leading-[1.7] text-status-failed">
                      {selectedRun.run.errorMessage}
                    </p>
                  ) : null}
                  {parsedState ? (
                    <div class="mt-4">
                      <CodeBlock>{parsedState}</CodeBlock>
                    </div>
                  ) : null}
                </Panel>

                <Panel class="p-6" variant="panel">
                  <div class="mb-4 flex items-center justify-between gap-3">
                    <h2 class="font-display text-[20px] font-semibold text-bone">
                      步骤
                    </h2>
                    <span class="font-mono text-[11px] text-bone-faint">
                      {selectedSteps.length} 条
                    </span>
                  </div>
                  {selectedSteps.length === 0 ? (
                    <p class="text-[14px] text-bone-soft">暂无步骤记录。</p>
                  ) : (
                    <div class="flex flex-col gap-3">
                      {selectedSteps.map((step) => (
                        <StepCard key={step.id} step={step} />
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel class="p-6" variant="panel">
                  <div class="mb-4 flex items-center justify-between gap-3">
                    <h2 class="font-display text-[20px] font-semibold text-bone">
                      产物
                    </h2>
                    <span class="font-mono text-[11px] text-bone-faint">
                      {selectedArtifacts.length} 个
                    </span>
                  </div>
                  {selectedArtifacts.length === 0 ? (
                    <p class="text-[14px] text-bone-soft">
                      本次运行未持久化任何产物。
                    </p>
                  ) : (
                    <div class="flex flex-col gap-3">
                      {selectedArtifacts.map((artifact) => (
                        <Panel key={artifact.id} class="p-4" variant="raised">
                          <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div class="text-[15px] font-semibold text-bone">
                                {formatLabel(artifact.artifactType)}
                              </div>
                              <div class="mt-1 font-mono text-[12px] text-bone-faint">
                                v{artifact.version} ·{" "}
                                {formatLabel(artifact.storageKind)}
                              </div>
                            </div>
                            <span class="font-mono text-[11px] text-bone-faint">
                              {artifact.id}
                            </span>
                          </div>
                          {renderArtifactBody(artifact)}
                        </Panel>
                      ))}
                    </div>
                  )}
                </Panel>
              </>
            ) : (
              <Panel class="p-6" variant="panel">
                <p class="text-[14px] text-bone-soft">
                  选择左侧一次运行，查看逐步执行细节。
                </p>
              </Panel>
            )}
          </div>
        </section>
      )}
    </PageShell>
  );
};
