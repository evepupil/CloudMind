import { createReadStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { z } from "zod";

import type {
  CLOUDMIND_DATA_TABLES,
  CloudMindDataPackageManifest,
} from "../../../src/features/sovereignty/model/data-package.ts";
import { resolvePackageFile } from "./file-integrity.ts";
import type { RestoreDataPackageInput } from "./types.ts";
import { runWrangler } from "./wrangler.ts";

const RESTORE_TABLE_ORDER: ReadonlyArray<
  (typeof CLOUDMIND_DATA_TABLES)[number]
> = [
  "assets",
  "auth_accounts",
  "mcp_tokens",
  "asset_sources",
  "ingest_jobs",
  "workflow_runs",
  "workflow_steps",
  "asset_artifacts",
  "asset_chunks",
  "entities",
  "statements",
  "edges",
  "communities",
  "provenance",
  "deletion_audits",
];
const SQL_WRITE_BATCH_SIZE = 50;
const SQL_WRITE_BATCH_BYTES = 256 * 1024;
const SQL_STATEMENT_TARGET_BYTES = 64 * 1024;
const SQL_TEXT_CHUNK_BYTES = 16 * 1024;
const rowSchema = z.record(z.string(), z.unknown());

interface SqlBatchState {
  bytes: number;
  count: number;
}

export const wouldOverflowSqlBatch = (
  state: SqlBatchState,
  statement: string
): boolean =>
  state.count > 0 &&
  (state.count >= SQL_WRITE_BATCH_SIZE ||
    state.bytes + Buffer.byteLength(statement, "utf8") + 1 >
      SQL_WRITE_BATCH_BYTES);

const toSqlLiteral = (value: unknown): string => {
  if (value === null) {
    return "NULL";
  }

  if (typeof value === "string") {
    return `CAST(X'${Buffer.from(value, "utf8").toString("hex")}' AS TEXT)`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  throw new Error("D1 export contains an unsupported value type.");
};

const splitUtf8Text = (value: string): string[] => {
  const chunks: string[] = [];
  let chunk = "";
  let bytes = 0;

  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, "utf8");

    if (chunk && bytes + characterBytes > SQL_TEXT_CHUNK_BYTES) {
      chunks.push(chunk);
      chunk = "";
      bytes = 0;
    }

    chunk += character;
    bytes += characterBytes;
  }

  if (chunk) {
    chunks.push(chunk);
  }

  return chunks;
};

export const buildInsertStatements = (
  table: string,
  row: unknown
): string[] => {
  const record = rowSchema.parse(row);
  const entries = Object.entries(record);

  if (entries.length === 0) {
    throw new Error(`D1 export contains an empty row for ${table}.`);
  }

  const externalizedColumns = new Set(
    entries
      .filter(
        ([column, value]) =>
          column !== "id" &&
          typeof value === "string" &&
          Buffer.byteLength(value, "utf8") > SQL_TEXT_CHUNK_BYTES
      )
      .map(([column]) => column)
  );
  const columns = entries.map(([column]) => `"${column}"`).join(", ");
  const buildInsert = (): string => {
    const values = entries
      .map(([column, value]) =>
        toSqlLiteral(externalizedColumns.has(column) ? "" : value)
      )
      .join(", ");

    return `INSERT INTO "${table}" (${columns}) VALUES (${values});`;
  };
  let insert = buildInsert();

  if (Buffer.byteLength(insert, "utf8") > SQL_STATEMENT_TARGET_BYTES) {
    const remainingStrings = entries
      .filter(
        ([column, value]) =>
          column !== "id" &&
          typeof value === "string" &&
          !externalizedColumns.has(column)
      )
      .sort(
        ([, left], [, right]) =>
          Buffer.byteLength(right as string, "utf8") -
          Buffer.byteLength(left as string, "utf8")
      );

    for (const [column] of remainingStrings) {
      externalizedColumns.add(column);
      insert = buildInsert();

      if (Buffer.byteLength(insert, "utf8") <= SQL_STATEMENT_TARGET_BYTES) {
        break;
      }
    }
  }

  if (Buffer.byteLength(insert, "utf8") > SQL_STATEMENT_TARGET_BYTES) {
    throw new Error(`D1 row for ${table} cannot fit the restore SQL limit.`);
  }

  if (externalizedColumns.size === 0) {
    return [insert];
  }

  const id = record.id;

  if (typeof id !== "string" && typeof id !== "number") {
    throw new Error(`D1 row for ${table} needs an id to restore large text.`);
  }

  const updates = entries.flatMap(([column, value]) => {
    if (!externalizedColumns.has(column) || typeof value !== "string") {
      return [];
    }

    return splitUtf8Text(value).map(
      (chunk) =>
        `UPDATE "${table}" SET "${column}" = "${column}" || ${toSqlLiteral(chunk)} WHERE "id" = ${toSqlLiteral(id)};`
    );
  });

  return [insert, ...updates];
};

const executeSqlBatch = (
  input: RestoreDataPackageInput,
  sqlPath: string,
  tableName: string,
  batchNumber: number
): void => {
  try {
    runWrangler(input.projectRoot, [
      "d1",
      "execute",
      input.resources.database,
      `--${input.mode}`,
      "--file",
      sqlPath,
      "--yes",
    ]);
  } catch {
    throw new Error(
      `D1 restore failed while importing ${tableName} batch ${batchNumber}.`
    );
  }
};

const restoreTable = async (
  input: RestoreDataPackageInput,
  table: CloudMindDataPackageManifest["database"]["tables"][number],
  sqlPath: string
): Promise<void> => {
  const lines = createInterface({
    input: createReadStream(resolvePackageFile(input.packagePath, table.path), {
      encoding: "utf8",
    }),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  let statements: string[] = [];
  let bytes = 0;
  let batchNumber = 0;

  const flush = async (): Promise<void> => {
    if (statements.length === 0) {
      return;
    }

    batchNumber += 1;
    await writeFile(sqlPath, `${statements.join("\n")}\n`, "utf8");
    executeSqlBatch(input, sqlPath, table.name, batchNumber);
    statements = [];
    bytes = 0;
  };

  for await (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const rowStatements = buildInsertStatements(
      table.name,
      JSON.parse(line) as unknown
    );

    for (const statement of rowStatements) {
      if (
        wouldOverflowSqlBatch({ bytes, count: statements.length }, statement)
      ) {
        await flush();
      }

      statements.push(statement);
      bytes += Buffer.byteLength(statement, "utf8") + 1;
    }
  }

  await flush();
};

export const restoreDatabaseRows = async (
  input: RestoreDataPackageInput,
  manifest: CloudMindDataPackageManifest
): Promise<void> => {
  const workingDirectory = await mkdtemp(
    join(tmpdir(), "cloudmind-d1-restore-")
  );
  const sqlPath = join(workingDirectory, "data.sql");

  try {
    for (const tableName of RESTORE_TABLE_ORDER) {
      const table = manifest.database.tables.find(
        (candidate) => candidate.name === tableName
      );

      if (!table) {
        throw new Error(
          `Database table is missing from the package: ${tableName}.`
        );
      }

      await restoreTable(input, table, sqlPath);
    }

    await writeFile(
      sqlPath,
      [
        "DELETE FROM asset_chunks_fts;",
        "INSERT INTO asset_chunks_fts(content, asset_id, chunk_id)",
        "SELECT content_text, asset_id, id FROM asset_chunks;",
      ].join("\n"),
      "utf8"
    );
    executeSqlBatch(input, sqlPath, "asset_chunks_fts", 1);
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
};
