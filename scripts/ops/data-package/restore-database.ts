import { z } from "zod";

import {
  CLOUDMIND_DATA_TABLES,
  type CloudMindDataPackageManifest,
} from "../../../src/features/sovereignty/model/data-package.ts";
import { resolveDatabaseRestoreAction } from "../../../src/features/sovereignty/model/restore-policy.ts";
import { resolvePackageFile } from "./file-integrity.ts";
import type { RestoreDataPackageInput } from "./types.ts";
import { queryD1, runWrangler } from "./wrangler.ts";

const tableNameSchema = z.object({ name: z.string() });
const tableCountSchema = z.object({
  table_name: z.string(),
  row_count: z.number().int().nonnegative(),
});

const readExistingTableCounts = (
  input: RestoreDataPackageInput
): Record<string, number> => {
  const knownTables = new Set<string>(CLOUDMIND_DATA_TABLES);
  const existingTables = queryD1(
    input.projectRoot,
    input.resources.database,
    input.mode,
    "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name"
  )
    .map((row) => tableNameSchema.parse(row).name)
    .filter((name) => knownTables.has(name));

  if (existingTables.length === 0) {
    return {};
  }

  const countSql = existingTables
    .map(
      (table) =>
        `SELECT '${table}' AS table_name, COUNT(*) AS row_count FROM "${table}"`
    )
    .join(" UNION ALL ");
  const rows = queryD1(
    input.projectRoot,
    input.resources.database,
    input.mode,
    countSql
  ).map((row) => tableCountSchema.parse(row));

  return Object.fromEntries(rows.map((row) => [row.table_name, row.row_count]));
};

const assertTableCountsMatch = (
  actual: Record<string, number>,
  expected: Record<string, number>
): void => {
  const matches = Object.entries(expected).every(
    ([table, count]) => actual[table] === count
  );

  if (!matches) {
    throw new Error(
      "Restored D1 table counts do not match the package manifest."
    );
  }
};

export const restoreDatabase = (
  input: RestoreDataPackageInput,
  manifest: CloudMindDataPackageManifest
): void => {
  const action = resolveDatabaseRestoreAction({
    existingTableCounts: readExistingTableCounts(input),
    manifest,
    resume: input.resume,
  });

  if (action === "import") {
    runWrangler(input.projectRoot, [
      "d1",
      "execute",
      input.resources.database,
      `--${input.mode}`,
      "--file",
      resolvePackageFile(input.packagePath, manifest.database.path),
      "--yes",
    ]);
  }

  assertTableCountsMatch(
    readExistingTableCounts(input),
    manifest.database.tableCounts
  );
};
