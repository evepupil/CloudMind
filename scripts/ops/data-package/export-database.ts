import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

import { CLOUDMIND_DATA_TABLES } from "../../../src/features/sovereignty/model/data-package.ts";
import { resolvePackageFile } from "./file-integrity.ts";
import type { ExportDataPackageInput } from "./types.ts";
import { queryD1, runWrangler } from "./wrangler.ts";

export const DATABASE_PACKAGE_PATH = "database/database.sql";

const tableCountSchema = z.object({
  table_name: z.string(),
  row_count: z.number().int().nonnegative(),
});

export const readTableCounts = (
  input: Pick<ExportDataPackageInput, "projectRoot" | "mode" | "resources">
): Record<string, number> => {
  const sql = CLOUDMIND_DATA_TABLES.map(
    (table) =>
      `SELECT '${table}' AS table_name, COUNT(*) AS row_count FROM "${table}"`
  ).join(" UNION ALL ");
  const rows = queryD1(
    input.projectRoot,
    input.resources.database,
    input.mode,
    sql
  ).map((row) => tableCountSchema.parse(row));

  return Object.fromEntries(rows.map((row) => [row.table_name, row.row_count]));
};

export const exportDatabase = async (
  input: ExportDataPackageInput
): Promise<string> => {
  const outputPath = resolvePackageFile(
    input.outputPath,
    DATABASE_PACKAGE_PATH
  );
  await mkdir(dirname(outputPath), { recursive: true });
  runWrangler(input.projectRoot, [
    "d1",
    "export",
    input.resources.database,
    `--${input.mode}`,
    "--output",
    outputPath,
    "--skip-confirmation",
  ]);

  return DATABASE_PACKAGE_PATH;
};
