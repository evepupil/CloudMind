import type { Child } from "hono/jsx";

import type {
  AssetAiVisibility,
  AssetDomain,
  AssetListQuery,
  AssetListResult,
  AssetSourceKind,
  AssetStatus,
  AssetSummary,
  AssetType,
} from "@/features/assets/model/types";
import { PageShell } from "@/features/layout/components/page-shell";
import {
  buttonClass,
  EmptyState,
  FlashMessage,
  Panel,
  StatusBadge,
} from "@/features/ui/components";

const assetStatusOptions: Array<{ label: string; value: AssetStatus | "" }> = [
  { label: "全部状态", value: "" },
  { label: "待处理", value: "pending" },
  { label: "处理中", value: "processing" },
  { label: "就绪", value: "ready" },
  { label: "失败", value: "failed" },
];

const assetTypeOptions: Array<{ label: string; value: AssetType | "" }> = [
  { label: "全部类型", value: "" },
  { label: "URL", value: "url" },
  { label: "PDF", value: "pdf" },
  { label: "笔记", value: "note" },
  { label: "图片", value: "image" },
  { label: "对话", value: "chat" },
];

const assetDomainOptions: Array<{ label: string; value: AssetDomain | "" }> = [
  { label: "全部领域", value: "" },
  { label: "工程", value: "engineering" },
  { label: "产品", value: "product" },
  { label: "研究", value: "research" },
  { label: "个人", value: "personal" },
  { label: "财务", value: "finance" },
  { label: "健康", value: "health" },
  { label: "归档", value: "archive" },
  { label: "通用", value: "general" },
];

const assetSourceKindOptions: Array<{
  label: string;
  value: AssetSourceKind | "";
}> = [
  { label: "全部来源", value: "" },
  { label: "手动", value: "manual" },
  { label: "浏览器插件", value: "browser_extension" },
  { label: "上传", value: "upload" },
  { label: "MCP", value: "mcp" },
  { label: "导入", value: "import" },
];

const assetAiVisibilityOptions: Array<{
  label: string;
  value: AssetAiVisibility | "";
}> = [
  { label: "全部可见性", value: "" },
  { label: "允许", value: "allow" },
  { label: "仅摘要", value: "summary_only" },
  { label: "拒绝", value: "deny" },
];

const formatDate = (value: string): string =>
  new Date(value).toLocaleString("zh-CN", { hour12: false });

const formatDateInputValue = (value: string | undefined): string =>
  value ? value.slice(0, 10) : "";

const formatLabel = (value: string): string =>
  value
    .split("_")
    .map((segment) =>
      segment.length > 0
        ? `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`
        : segment
    )
    .join(" ");

const buildAssetTags = (asset: AssetSummary): string[] => {
  const tags = [
    asset.domain,
    asset.aiVisibility,
    asset.sourceKind,
    asset.sourceHost,
  ].filter((value): value is string => Boolean(value?.trim()));

  return Array.from(new Set(tags));
};

// 筛选区下拉：复用同一套 Observatory 暗底样式。
const selectClass =
  "w-full rounded-md border border-line bg-ink-raised px-3 py-2 text-[14px] text-bone outline-none transition-colors focus:border-brass";
const fieldLabelClass = "text-[12px] font-medium text-bone-soft";

const Field = ({ label, children }: { label: string; children: Child }) => (
  // label 隐式包裹表单控件（W3C 合法关联）；biome 静态分析认不出动态 children。
  // biome-ignore lint/a11y/noLabelWithoutControl: children 总是表单控件，隐式关联成立
  <label class="grid gap-1.5">
    <span class={fieldLabelClass}>{label}</span>
    {children}
  </label>
);

// 记忆库：知识浏览器结构——计量 + 多维筛选 + 资产卡片流 + 分页。
export const AssetsPage = ({
  items,
  pagination,
  filters,
  errorMessage,
  flashMessage,
}: {
  items: AssetSummary[];
  pagination: AssetListResult["pagination"];
  filters: AssetListQuery;
  errorMessage?: string | undefined;
  flashMessage?: string | undefined;
}) => {
  const previousPage = pagination.page > 1 ? pagination.page - 1 : null;
  const nextPage =
    pagination.page < pagination.totalPages ? pagination.page + 1 : null;
  const currentParams = new URLSearchParams();

  const setParam = (key: string, value: string | undefined | null) => {
    if (value) {
      currentParams.set(key, value);
    }
  };
  setParam("status", filters.status);
  setParam("type", filters.type);
  setParam("domain", filters.domain);
  setParam("sourceKind", filters.sourceKind);
  setParam("aiVisibility", filters.aiVisibility);
  setParam("createdAtFrom", filters.createdAtFrom);
  setParam("createdAtTo", filters.createdAtTo);
  if (filters.timezoneOffsetMinutes !== undefined) {
    currentParams.set(
      "timezoneOffsetMinutes",
      String(filters.timezoneOffsetMinutes)
    );
  }
  setParam("sourceHost", filters.sourceHost);
  setParam("query", filters.query);
  if (filters.pageSize) {
    currentParams.set("pageSize", String(filters.pageSize));
  }

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams(currentParams);
    params.set("page", String(page));
    return `/assets?${params.toString()}`;
  };

  return (
    <PageShell
      navigationKey="library"
      eyebrow="工作区 · 记忆库"
      title={
        <>
          你的<em class="italic text-brass">记忆</em>馆藏
        </>
      }
      subtitle="把收进来的知识当作一座活的图书馆浏览。按类型、状态、领域筛选，再钻进详情或继续采集。"
      actions={
        <>
          <a class={buttonClass("subtle")} href="/ask">
            ? 问答
          </a>
          <a class={buttonClass("primary")} href="/capture">
            + 采集
          </a>
        </>
      }
    >
      {flashMessage ? (
        <FlashMessage kind="success" class="mb-4">
          {flashMessage}
        </FlashMessage>
      ) : null}
      {errorMessage ? (
        <FlashMessage kind="error" class="mb-4">
          {errorMessage}
        </FlashMessage>
      ) : null}

      {/* 计量条 */}
      <div class="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span class="font-display text-[28px] font-medium tabular-nums text-bone">
          {pagination.total}
        </span>
        <span class="text-[14px] text-bone-soft">条记忆</span>
        <span class="font-mono text-[12px] text-bone-faint">
          · 第 {pagination.page} / {Math.max(1, pagination.totalPages)} 页
        </span>
      </div>

      {/* 筛选区 */}
      <Panel class="mb-5 p-5" variant="panel">
        <form
          method="get"
          action="/assets"
          class="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3"
        >
          <input
            id="assets-timezone-offset"
            name="timezoneOffsetMinutes"
            type="hidden"
            defaultValue={
              filters.timezoneOffsetMinutes !== undefined
                ? String(filters.timezoneOffsetMinutes)
                : ""
            }
          />
          <Field label="状态">
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              class={selectClass}
            >
              {assetStatusOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="类型">
            <select
              name="type"
              defaultValue={filters.type ?? ""}
              class={selectClass}
            >
              {assetTypeOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="领域">
            <select
              name="domain"
              defaultValue={filters.domain ?? ""}
              class={selectClass}
            >
              {assetDomainOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="来源">
            <select
              name="sourceKind"
              defaultValue={filters.sourceKind ?? ""}
              class={selectClass}
            >
              {assetSourceKindOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="AI 可见性">
            <select
              name="aiVisibility"
              defaultValue={filters.aiVisibility ?? ""}
              class={selectClass}
            >
              {assetAiVisibilityOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="创建起">
            <input
              name="createdAtFrom"
              type="date"
              defaultValue={formatDateInputValue(filters.createdAtFrom)}
              class={selectClass}
            />
          </Field>
          <Field label="创建止">
            <input
              name="createdAtTo"
              type="date"
              defaultValue={formatDateInputValue(filters.createdAtTo)}
              class={selectClass}
            />
          </Field>
          <Field label="来源主机">
            <input
              name="sourceHost"
              type="search"
              defaultValue={filters.sourceHost ?? ""}
              placeholder="developers.cloudflare.com"
              class={selectClass}
            />
          </Field>
          <Field label="搜索">
            <input
              name="query"
              type="search"
              defaultValue={filters.query ?? ""}
              placeholder="标题、摘要或来源 URL"
              class={selectClass}
            />
          </Field>
          <div class="flex items-end gap-3">
            <button type="submit" class={buttonClass("primary")}>
              应用筛选
            </button>
            <a
              href="/assets"
              class="text-[14px] font-medium text-bone-soft no-underline transition-colors hover:text-bone"
            >
              重置
            </a>
          </div>
        </form>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.addEventListener('DOMContentLoaded', function () {" +
              "var input = document.getElementById('assets-timezone-offset');" +
              "if (input instanceof HTMLInputElement) {" +
              "input.value = String(new Date().getTimezoneOffset());" +
              "}" +
              "});",
          }}
        />
      </Panel>

      {/* 资产卡片流 */}
      {items.length === 0 ? (
        <EmptyState
          title="记忆库还是空的"
          description="从采集收进第一条 URL、笔记或 PDF，或用 MCP 的 remember 写入。"
          action={
            <a class={buttonClass("primary")} href="/capture">
              开始采集
            </a>
          }
        />
      ) : (
        <div class="flex flex-col gap-3">
          {items.map((asset) => (
            <Panel key={asset.id} class="p-5" variant="panel">
              {buildAssetTags(asset).length > 0 ? (
                <div class="mb-2.5 flex flex-wrap gap-1.5">
                  {buildAssetTags(asset).map((tag) => (
                    <span
                      key={`${asset.id}:${tag}`}
                      class="rounded bg-ink-raised px-2 py-0.5 font-mono text-[11px] text-bone-soft"
                    >
                      {formatLabel(tag)}
                    </span>
                  ))}
                </div>
              ) : null}
              <div class="mb-2.5 flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <a
                    href={`/assets/${asset.id}`}
                    class="text-[16px] font-semibold text-bone no-underline transition-colors hover:text-brass"
                  >
                    {asset.title}
                  </a>
                  <div class="mt-1 font-mono text-[11px] text-bone-faint">
                    {asset.type} · 创建于 {formatDate(asset.createdAt)}
                  </div>
                </div>
                <StatusBadge status={asset.status} />
              </div>
              <p class="mb-3 text-[14px] leading-relaxed text-bone-soft">
                {asset.summary ?? "摘要尚未生成，当前展示原始元数据。"}
              </p>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0 truncate font-mono text-[12px] text-bone-faint">
                  {asset.sourceHost ?? asset.sourceUrl ?? `ID: ${asset.id}`}
                </div>
                <div class="flex gap-4">
                  <a
                    href={`/assets/${asset.id}`}
                    class="text-[13px] font-semibold text-brass no-underline hover:text-brass-bright"
                  >
                    查看详情 →
                  </a>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {/* 分页 */}
      {pagination.totalPages > 1 ? (
        <div class="mt-5 flex items-center justify-between gap-3">
          <span class="font-mono text-[12px] text-bone-faint">
            第 {pagination.page} / {pagination.totalPages} 页
          </span>
          <div class="flex gap-2.5">
            {previousPage ? (
              <a
                class={buttonClass("subtle", "sm")}
                href={buildPageHref(previousPage)}
              >
                ← 上一页
              </a>
            ) : (
              <span
                class={`${buttonClass("subtle", "sm")} pointer-events-none opacity-40`}
              >
                ← 上一页
              </span>
            )}
            {nextPage ? (
              <a
                class={buttonClass("subtle", "sm")}
                href={buildPageHref(nextPage)}
              >
                下一页 →
              </a>
            ) : (
              <span
                class={`${buttonClass("subtle", "sm")} pointer-events-none opacity-40`}
              >
                下一页 →
              </span>
            )}
          </div>
        </div>
      ) : null}
    </PageShell>
  );
};
