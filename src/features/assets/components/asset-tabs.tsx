type AssetTabKey = "detail" | "workflows";

const tabs: Array<{
  key: AssetTabKey;
  label: string;
  buildHref: (assetId: string) => string;
}> = [
  {
    key: "detail",
    label: "资产详情",
    buildHref: (assetId) => `/assets/${assetId}`,
  },
  {
    key: "workflows",
    label: "工作流检视",
    buildHref: (assetId) => `/assets/${assetId}/workflows`,
  },
];

// 详情/工作流切换标签：Observatory 暗底分段控件。
export const AssetTabs = ({
  assetId,
  activeTab,
}: {
  assetId: string;
  activeTab: AssetTabKey;
}) => {
  return (
    <nav class="mb-5 inline-flex gap-1 rounded-lg border border-line bg-ink-raised p-1">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;

        return (
          <a
            key={tab.key}
            href={tab.buildHref(assetId)}
            aria-current={isActive ? "page" : undefined}
            class={`rounded-md px-3.5 py-1.5 text-[13.5px] font-medium no-underline transition-colors ${
              isActive
                ? "bg-brass text-on-brass"
                : "text-bone-soft hover:bg-[rgba(236,228,212,0.04)] hover:text-bone"
            }`}
          >
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
};
