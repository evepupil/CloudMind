export const AssetPageActions = ({
  assetId,
}: {
  assetId?: string | undefined;
}) => {
  void assetId;

  return (
    <>
      <a
        href="/assets"
        class="rounded-md bg-[#f1f1f0] text-[#37352f] px-3 py-1.5 font-medium no-underline hover:bg-[#ebebea]"
      >
        Back to Library
      </a>
      <a
        href="/ask"
        class="rounded-md bg-[#e8f0fa] text-[#2383e2] px-3 py-1.5 font-medium no-underline hover:bg-[#d6e6f7]"
      >
        Ask About This
      </a>
    </>
  );
};
