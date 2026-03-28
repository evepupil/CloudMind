import { AssetPageActions } from "@/features/assets/components/asset-page-actions";
import { AssetTabs } from "@/features/assets/components/asset-tabs";
import type { AssetDetail } from "@/features/assets/model/types";
import { PageShell } from "@/features/layout/components/page-shell";
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

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
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

const formatLabel = (value: string): string => {
  return value
    .split("_")
    .map((segment) =>
      segment.length > 0
        ? `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`
        : segment
    )
    .join(" ");
};

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
  } catch {}

  if (preview.length <= limit) {
    return preview;
  }

  return `${preview.slice(0, limit).trimEnd()}\n...`;
};

const getRunStatusClasses = (status: WorkflowRunStatus): string => {
  switch (status) {
    case "succeeded":
      return "bg-[#e3f2e8] text-[#2e6c3e] border-[#b7dbbf]";
    case "failed":
      return "bg-[#f9e3e3] text-[#9c2e2e] border-[#e8b7b7]";
    case "running":
      return "bg-[#e8f0fa] text-[#2383e2] border-[#c8daf5]";
    case "cancelled":
      return "bg-[#f5efe4] text-[#8a5a00] border-[#e3d0ac]";
    default:
      return "bg-[#f3f3f2] text-[#787774] border-[#e8e8e7]";
  }
};

const getStepStatusClasses = (status: WorkflowStepStatus): string => {
  switch (status) {
    case "succeeded":
      return "bg-[#e3f2e8] text-[#2e6c3e] border-[#b7dbbf]";
    case "failed":
      return "bg-[#f9e3e3] text-[#9c2e2e] border-[#e8b7b7]";
    case "running":
      return "bg-[#e8f0fa] text-[#2383e2] border-[#c8daf5]";
    case "skipped":
      return "bg-[#f5efe4] text-[#8a5a00] border-[#e3d0ac]";
    default:
      return "bg-[#f3f3f2] text-[#787774] border-[#e8e8e7]";
  }
};

const StatusChip = ({
  label,
  className,
}: {
  label: string;
  className: string;
}) => {
  return (
    <span
      class={`inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.08em] ${className}`}
    >
      {label}
    </span>
  );
};

const MessageBanner = ({
  children,
  tone,
}: {
  children: string;
  tone: "success" | "error";
}) => {
  const toneClasses =
    tone === "success"
      ? "bg-[#e3f2e8] text-[#2e6c3e] border-[#b7dbbf]"
      : "bg-[#f9e3e3] text-[#9c2e2e] border-[#e8b7b7]";

  return (
    <section class={`mb-[18px] px-4 py-3 rounded-md border ${toneClasses}`}>
      {children}
    </section>
  );
};

const buildRunHref = (assetId: string, runId: string): string => {
  return `/assets/${assetId}/workflows?runId=${encodeURIComponent(runId)}`;
};

const renderArtifactBody = (artifact: AssetArtifactRecord) => {
  const contentPreview = artifact.contentText?.trim()
    ? artifact.contentText.trim().slice(0, 400)
    : null;
  const metadataPreview = formatJsonPreview(artifact.metadataJson, 320);

  return (
    <div class="grid gap-2.5">
      <div class="text-[#787774] text-[13px]">
        Created: {formatDate(artifact.createdAt)}
      </div>
      {artifact.r2Key ? (
        <div class="rounded-md bg-[#fafaf9] border border-[#ededec] px-3 py-2.5">
          <div class="text-[#9b9a97] text-[11px] font-bold uppercase tracking-[0.08em]">
            R2 Key
          </div>
          <div class="mt-1.5 break-words font-[IBM_Plex_Mono,SFMono-Regular,Consolas,monospace] text-[13px] text-[#37352f]">
            {artifact.r2Key}
          </div>
        </div>
      ) : null}
      {contentPreview ? (
        <pre class="m-0 whitespace-pre-wrap break-words rounded-md bg-[#fafaf9] border border-[#ededec] p-3 font-[IBM_Plex_Mono,SFMono-Regular,Consolas,monospace] text-[13px] leading-[1.7] text-[#37352f]">
          {contentPreview}
        </pre>
      ) : null}
      {metadataPreview ? (
        <pre class="m-0 whitespace-pre-wrap break-words rounded-md bg-[#fafaf9] border border-[#ededec] p-3 font-[IBM_Plex_Mono,SFMono-Regular,Consolas,monospace] text-[13px] leading-[1.7] text-[#37352f]">
          {metadataPreview}
        </pre>
      ) : null}
    </div>
  );
};

const StepCard = ({ step }: { step: WorkflowStepRecord }) => {
  const outputPreview = formatJsonPreview(step.outputJson, 480);

  return (
    <article class="rounded-lg border border-[#e8e8e7] bg-white p-5">
      <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div class="text-[16px] font-semibold text-[#37352f]">
            {formatLabel(step.stepKey)}
          </div>
          <div class="mt-1 text-[13px] text-[#787774]">
            Type {formatLabel(step.stepType)} · Attempt {step.attempt}
          </div>
        </div>
        <StatusChip
          label={step.status}
          className={getStepStatusClasses(step.status)}
        />
      </div>
      <div class="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <div class="rounded-md bg-[#fafaf9] border border-[#ededec] px-3 py-2.5">
          <div class="text-[#9b9a97] text-[11px] font-bold uppercase tracking-[0.08em]">
            Started
          </div>
          <div class="mt-1.5 text-[#37352f]">{formatDate(step.startedAt)}</div>
        </div>
        <div class="rounded-md bg-[#fafaf9] border border-[#ededec] px-3 py-2.5">
          <div class="text-[#9b9a97] text-[11px] font-bold uppercase tracking-[0.08em]">
            Finished
          </div>
          <div class="mt-1.5 text-[#37352f]">{formatDate(step.finishedAt)}</div>
        </div>
        <div class="rounded-md bg-[#fafaf9] border border-[#ededec] px-3 py-2.5">
          <div class="text-[#9b9a97] text-[11px] font-bold uppercase tracking-[0.08em]">
            Duration
          </div>
          <div class="mt-1.5 text-[#37352f]">
            {formatDuration(step.startedAt, step.finishedAt)}
          </div>
        </div>
      </div>
      {step.errorMessage ? (
        <p class="mt-3 mb-0 rounded-md border border-[#e8b7b7] bg-[#f9e3e3] px-3 py-2.5 text-[#9c2e2e] leading-[1.7]">
          {step.errorMessage}
        </p>
      ) : null}
      {outputPreview ? (
        <pre class="mt-3 mb-0 whitespace-pre-wrap break-words rounded-md bg-[#fafaf9] border border-[#ededec] p-3 font-[IBM_Plex_Mono,SFMono-Regular,Consolas,monospace] text-[13px] leading-[1.7] text-[#37352f]">
          {outputPreview}
        </pre>
      ) : null}
    </article>
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
        title="Workflow Inspection"
        subtitle="Inspect workflow runs, steps, and generated artifacts for a single asset."
        navigationKey="library"
        actions={<AssetPageActions />}
      >
        <MessageBanner tone="error">
          {errorMessage ?? "Asset not found."}
        </MessageBanner>
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
      title={item.title}
      subtitle="Inspect workflow runs, step timing, and generated artifacts in a dedicated view instead of crowding the asset detail page."
      navigationKey="library"
      actions={<AssetPageActions assetId={item.id} />}
    >
      {errorMessage ? (
        <MessageBanner tone="error">{errorMessage}</MessageBanner>
      ) : null}

      <AssetTabs assetId={item.id} activeTab="workflows" />

      <section class="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <article class="rounded-lg border border-[#e8e8e7] bg-white px-5 py-4">
          <div class="text-[#9b9a97] text-[12px] font-bold uppercase tracking-[0.08em]">
            Workflow Runs
          </div>
          <div class="mt-2 text-[28px] font-semibold text-[#37352f]">
            {runs.length}
          </div>
        </article>
        <article class="rounded-lg border border-[#e8e8e7] bg-white px-5 py-4">
          <div class="text-[#9b9a97] text-[12px] font-bold uppercase tracking-[0.08em]">
            Latest Status
          </div>
          <div class="mt-2">
            {latestRun ? (
              <StatusChip
                label={latestRun.status}
                className={getRunStatusClasses(latestRun.status)}
              />
            ) : (
              <span class="text-[#787774]">No runs yet</span>
            )}
          </div>
        </article>
        <article class="rounded-lg border border-[#e8e8e7] bg-white px-5 py-4">
          <div class="text-[#9b9a97] text-[12px] font-bold uppercase tracking-[0.08em]">
            Active Run
          </div>
          <div class="mt-2 text-[#37352f] font-semibold break-words">
            {activeRunId ?? "N/A"}
          </div>
        </article>
        <article class="rounded-lg border border-[#e8e8e7] bg-white px-5 py-4">
          <div class="text-[#9b9a97] text-[12px] font-bold uppercase tracking-[0.08em]">
            Selected Artifacts
          </div>
          <div class="mt-2 text-[28px] font-semibold text-[#37352f]">
            {selectedArtifacts.length}
          </div>
        </article>
      </section>

      {runs.length === 0 ? (
        <article class="rounded-lg border border-dashed border-[#e8e8e7] bg-white p-6 text-[#787774]">
          No workflow runs have been created for this asset yet.
        </article>
      ) : (
        <section class="grid grid-cols-[minmax(280px,0.62fr)_minmax(0,1.38fr)] gap-[18px]">
          <aside class="grid gap-[18px]">
            <article class="rounded-lg border border-[#e8e8e7] bg-white p-5">
              <div class="flex items-center justify-between gap-3 mb-3">
                <h2 class="m-0 text-[20px]">Runs</h2>
                <span class="text-[13px] text-[#787774]">Latest first</span>
              </div>
              <div class="grid gap-3">
                {runs.map((run) => {
                  const isActive = run.id === activeRunId;

                  return (
                    <a
                      key={run.id}
                      href={buildRunHref(item.id, run.id)}
                      class={`rounded-lg border p-4 no-underline transition-colors ${
                        isActive
                          ? "border-[#37352f] bg-[#f7f6f3]"
                          : "border-[#ededec] bg-[#fafaf9] hover:border-[#d7d7d6] hover:bg-white"
                      }`}
                    >
                      <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div class="text-[15px] font-semibold text-[#37352f] break-words">
                            {formatLabel(run.workflowType)}
                          </div>
                          <div class="mt-1 text-[13px] text-[#787774]">
                            {formatLabel(run.triggerType)} ·{" "}
                            {formatDate(run.createdAt)}
                          </div>
                        </div>
                        <StatusChip
                          label={run.status}
                          className={getRunStatusClasses(run.status)}
                        />
                      </div>
                      <div class="mt-3 text-[13px] text-[#787774]">
                        Current step:{" "}
                        <span class="text-[#37352f]">
                          {run.currentStep
                            ? formatLabel(run.currentStep)
                            : "N/A"}
                        </span>
                      </div>
                      {run.errorMessage ? (
                        <p class="mt-3 mb-0 text-[13px] leading-[1.7] text-[#9c2e2e]">
                          {run.errorMessage}
                        </p>
                      ) : null}
                    </a>
                  );
                })}
              </div>
            </article>
          </aside>

          <div class="grid gap-[18px]">
            {selectedRun ? (
              <>
                <article class="rounded-lg border border-[#e8e8e7] bg-white p-6">
                  <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <div class="text-[#787774] text-[13px]">
                        Run ID {selectedRun.run.id}
                      </div>
                      <h2 class="mt-1 mb-0 text-[24px]">
                        {formatLabel(selectedRun.run.workflowType)}
                      </h2>
                    </div>
                    <StatusChip
                      label={selectedRun.run.status}
                      className={getRunStatusClasses(selectedRun.run.status)}
                    />
                  </div>
                  <div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                    <div class="rounded-md bg-[#fafaf9] border border-[#ededec] px-4 py-3.5">
                      <div class="text-[#9b9a97] text-[12px] font-bold uppercase tracking-[0.08em]">
                        Trigger
                      </div>
                      <div class="mt-2 text-[#37352f] font-bold">
                        {formatLabel(selectedRun.run.triggerType)}
                      </div>
                    </div>
                    <div class="rounded-md bg-[#fafaf9] border border-[#ededec] px-4 py-3.5">
                      <div class="text-[#9b9a97] text-[12px] font-bold uppercase tracking-[0.08em]">
                        Current Step
                      </div>
                      <div class="mt-2 text-[#37352f] font-bold">
                        {selectedRun.run.currentStep
                          ? formatLabel(selectedRun.run.currentStep)
                          : "N/A"}
                      </div>
                    </div>
                    <div class="rounded-md bg-[#fafaf9] border border-[#ededec] px-4 py-3.5">
                      <div class="text-[#9b9a97] text-[12px] font-bold uppercase tracking-[0.08em]">
                        Started
                      </div>
                      <div class="mt-2 text-[#37352f] font-bold">
                        {formatDate(selectedRun.run.startedAt)}
                      </div>
                    </div>
                    <div class="rounded-md bg-[#fafaf9] border border-[#ededec] px-4 py-3.5">
                      <div class="text-[#9b9a97] text-[12px] font-bold uppercase tracking-[0.08em]">
                        Finished
                      </div>
                      <div class="mt-2 text-[#37352f] font-bold">
                        {formatDate(selectedRun.run.finishedAt)}
                      </div>
                    </div>
                  </div>
                  {selectedRun.run.errorMessage ? (
                    <p class="mt-4 mb-0 rounded-md border border-[#e8b7b7] bg-[#f9e3e3] px-4 py-3 text-[#9c2e2e] leading-[1.7]">
                      {selectedRun.run.errorMessage}
                    </p>
                  ) : null}
                  {parsedState ? (
                    <pre class="mt-4 mb-0 whitespace-pre-wrap break-words rounded-md bg-[#fafaf9] border border-[#ededec] p-4 font-[IBM_Plex_Mono,SFMono-Regular,Consolas,monospace] text-[13px] leading-[1.7] text-[#37352f]">
                      {parsedState}
                    </pre>
                  ) : null}
                </article>

                <article class="rounded-lg border border-[#e8e8e7] bg-white p-6">
                  <div class="flex items-center justify-between gap-3 mb-4">
                    <h2 class="m-0 text-[22px]">Steps</h2>
                    <span class="text-[13px] text-[#787774]">
                      {selectedSteps.length} recorded
                    </span>
                  </div>
                  {selectedSteps.length === 0 ? (
                    <p class="mb-0 text-[#787774]">No step records yet.</p>
                  ) : (
                    <div class="grid gap-3">
                      {selectedSteps.map((step) => (
                        <StepCard key={step.id} step={step} />
                      ))}
                    </div>
                  )}
                </article>

                <article class="rounded-lg border border-[#e8e8e7] bg-white p-6">
                  <div class="flex items-center justify-between gap-3 mb-4">
                    <h2 class="m-0 text-[22px]">Artifacts</h2>
                    <span class="text-[13px] text-[#787774]">
                      {selectedArtifacts.length} generated
                    </span>
                  </div>
                  {selectedArtifacts.length === 0 ? (
                    <p class="mb-0 text-[#787774]">
                      No artifacts were persisted for this run.
                    </p>
                  ) : (
                    <div class="grid gap-3">
                      {selectedArtifacts.map((artifact) => (
                        <article
                          key={artifact.id}
                          class="rounded-lg border border-[#ededec] bg-[#fafaf9] p-4"
                        >
                          <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
                            <div>
                              <div class="text-[16px] font-semibold text-[#37352f]">
                                {formatLabel(artifact.artifactType)}
                              </div>
                              <div class="mt-1 text-[13px] text-[#787774]">
                                Version {artifact.version} ·{" "}
                                {formatLabel(artifact.storageKind)}
                              </div>
                            </div>
                            <span class="text-[12px] font-bold uppercase tracking-[0.08em] text-[#9b9a97]">
                              {artifact.id}
                            </span>
                          </div>
                          {renderArtifactBody(artifact)}
                        </article>
                      ))}
                    </div>
                  )}
                </article>
              </>
            ) : (
              <article class="rounded-lg border border-dashed border-[#e8e8e7] bg-white p-6 text-[#787774]">
                Select a workflow run to inspect step-by-step execution details.
              </article>
            )}
          </div>
        </section>
      )}
    </PageShell>
  );
};
