import type { CloudMindDataPackageManifest } from "./data-package";

export type DatabaseRestoreAction = "import" | "skip";

interface ResolveDatabaseRestoreActionInput {
  existingTableCounts: Record<string, number>;
  manifest: CloudMindDataPackageManifest;
  resume: boolean;
}

// 新库允许导入；续跑只接受与清单完全一致的库，防止把备份覆盖到已有数据上。
export const resolveDatabaseRestoreAction = (
  input: ResolveDatabaseRestoreActionInput
): DatabaseRestoreAction => {
  const existingEntries = Object.entries(input.existingTableCounts);

  if (
    existingEntries.length === 0 ||
    existingEntries.every(([, count]) => count === 0)
  ) {
    return "import";
  }

  if (!input.resume) {
    throw new Error(
      "Target D1 already contains CloudMind tables. Use a fresh database or --resume."
    );
  }

  const expectedEntries = Object.entries(input.manifest.database.tableCounts);
  const allExpectedMatch = expectedEntries.every(
    ([table, count]) => input.existingTableCounts[table] === count
  );
  const hasUnexpectedTable = existingEntries.some(
    ([table]) => input.manifest.database.tableCounts[table] === undefined
  );

  if (!allExpectedMatch || hasUnexpectedTable) {
    throw new Error(
      "Target D1 does not match the package manifest, so restore cannot resume safely."
    );
  }

  return "skip";
};
