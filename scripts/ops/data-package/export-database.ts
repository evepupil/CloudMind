import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

import {
  CLOUDMIND_DATA_TABLES,
  type CloudMindDataPackageManifest,
} from "../../../src/features/sovereignty/model/data-package.ts";
import { mapWithConcurrency } from "./concurrency.ts";
import { resolvePackageFile } from "./file-integrity.ts";
import type { ExportDataPackageInput } from "./types.ts";
import { queryD1 } from "./wrangler.ts";

const PAGE_SIZE = 25;
const rowSchema = z
  .object({ __cloudmind_rowid: z.number().int() })
  .passthrough();

interface ExportedDatabase {
  tables: CloudMindDataPackageManifest["database"]["tables"];
  tableCounts: Record<string, number>;
}

const getTablePackagePath = (table: string): string =>
  `database/tables/${table}.ndjson`;

const exportTable = async (
  input: ExportDataPackageInput,
  table: (typeof CLOUDMIND_DATA_TABLES)[number]
): Promise<CloudMindDataPackageManifest["database"]["tables"][number]> => {
  const packagePath = getTablePackagePath(table);
  const outputPath = resolvePackageFile(input.outputPath, packagePath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, "", "utf8");
  let cursor: number | null = null;
  let count = 0;

  while (true) {
    const cursorCondition: string =
      cursor === null ? "" : `WHERE rowid > ${cursor}`;
    const rows: z.infer<typeof rowSchema>[] = queryD1(
      input.projectRoot,
      input.resources.database,
      input.mode,
      `SELECT rowid AS __cloudmind_rowid, * FROM "${table}" ${cursorCondition} ORDER BY rowid LIMIT ${PAGE_SIZE}`
    ).map((row) => rowSchema.parse(row));

    if (rows.length > 0) {
      await appendFile(
        outputPath,
        `${rows
          .map(({ __cloudmind_rowid: _rowId, ...row }) => JSON.stringify(row))
          .join("\n")}\n`,
        "utf8"
      );
      count += rows.length;
      cursor = rows.at(-1)?.__cloudmind_rowid ?? null;
    }

    if (rows.length < PAGE_SIZE) {
      return { name: table, path: packagePath, count };
    }
  }
};

export const exportDatabase = async (
  input: ExportDataPackageInput
): Promise<ExportedDatabase> => {
  const tables = await mapWithConcurrency(
    CLOUDMIND_DATA_TABLES,
    4,
    async (table) => exportTable(input, table)
  );

  return {
    tables,
    tableCounts: Object.fromEntries(
      tables.map((table) => [table.name, table.count])
    ),
  };
};
