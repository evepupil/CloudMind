type AssetTabKey = "detail" | "workflows";

const tabs: Array<{
  key: AssetTabKey;
  label: string;
  buildHref: (assetId: string) => string;
}> = [
  {
    key: "detail",
    label: "Asset Detail",
    buildHref: (assetId) => `/assets/${assetId}`,
  },
  {
    key: "workflows",
    label: "Workflow Inspection",
    buildHref: (assetId) => `/assets/${assetId}/workflows`,
  },
];

export const AssetTabs = ({
  assetId,
  activeTab,
}: {
  assetId: string;
  activeTab: AssetTabKey;
}) => {
  return (
    <nav class="mb-[18px] rounded-lg border border-[#e8e8e7] bg-white p-2">
      <div class="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;

          return (
            <a
              key={tab.key}
              href={tab.buildHref(assetId)}
              aria-current={isActive ? "page" : undefined}
              class={`rounded-md px-3 py-1.5 text-[14px] font-medium no-underline transition-colors ${
                isActive
                  ? "bg-[#37352f] text-white"
                  : "bg-[#f7f6f3] text-[#787774] hover:bg-[#f1f1f0] hover:text-[#37352f]"
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
};
