import { describe, expect, it } from "vitest";
import { buildVectorIdArgs } from "../../../scripts/ops/data-package/export-vectorize";
import {
  parseDataPackageCliOptions,
  resolveResourceNames,
} from "../../../scripts/ops/data-package/options";
import {
  buildInsertStatements,
  wouldOverflowSqlBatch,
} from "../../../scripts/ops/data-package/restore-database-data";
import { buildRestoreWranglerConfig } from "../../../scripts/ops/data-package/restore-database-migrations";
import { parseWranglerJson } from "../../../scripts/ops/data-package/wrangler";

const configured = {
  database: "configured-db",
  bucket: "configured-bucket",
  assetIndex: "configured-assets",
  graphIndex: "configured-graph",
};

describe("CloudMind data CLI options", () => {
  it("requires an explicit local or remote mode for export", () => {
    expect(() =>
      parseDataPackageCliOptions(["export", "--output", "backup"])
    ).toThrow("Choose --remote or --local explicitly");
  });

  it("requires explicit restore target resources", () => {
    const options = parseDataPackageCliOptions([
      "restore",
      "--package",
      "backup",
      "--remote",
    ]);

    expect(() => resolveResourceNames(options, configured)).toThrow(
      "Restore requires explicit"
    );
  });

  it("uses configured source resources for export", () => {
    const options = parseDataPackageCliOptions([
      "export",
      "--output",
      "backup",
      "--remote",
    ]);

    expect(resolveResourceNames(options, configured)).toEqual(configured);
  });
});

describe("Wrangler JSON parsing", () => {
  it("extracts JSON after a progress line", () => {
    expect(
      parseWranglerJson('Fetching vectors...\n[{"id":"vector-1","values":[1]}]')
    ).toEqual([{ id: "vector-1", values: [1] }]);
  });

  it("repeats the ids flag so Wrangler does not join vector ids", () => {
    expect(buildVectorIdArgs(["vector-a", "vector-b"])).toEqual([
      "--ids",
      "vector-a",
      "--ids",
      "vector-b",
    ]);
  });
});

describe("restore migration configuration", () => {
  it("binds migrations only to the explicit restore database", () => {
    const config = JSON.parse(
      buildRestoreWranglerConfig({
        databaseId: "11111111-1111-4111-8111-111111111111",
        databaseName: "cloudmind-restore-db",
        migrationsDirectory: "C:\\code\\CloudMind\\drizzle",
      })
    ) as {
      d1_databases: Array<Record<string, string>>;
    };

    expect(config.d1_databases).toEqual([
      {
        binding: "RESTORE_DB",
        database_name: "cloudmind-restore-db",
        database_id: "11111111-1111-4111-8111-111111111111",
        migrations_dir: "C:\\code\\CloudMind\\drizzle",
      },
    ]);
  });

  it("splits large D1 imports before the request-size boundary", () => {
    expect(
      wouldOverflowSqlBatch(
        { bytes: 255 * 1024, count: 2 },
        "x".repeat(2 * 1024)
      )
    ).toBe(true);
    expect(
      wouldOverflowSqlBatch({ bytes: 0, count: 0 }, "x".repeat(300 * 1024))
    ).toBe(false);
  });

  it("restores oversized UTF-8 text through bounded update statements", () => {
    const statements = buildInsertStatements("workflow_runs", {
      id: "run-1",
      output_json: "记".repeat(24_000),
    });

    expect(statements.length).toBeGreaterThan(2);
    expect(
      statements.every(
        (statement) => Buffer.byteLength(statement, "utf8") <= 64 * 1024
      )
    ).toBe(true);
    expect(
      statements.slice(1).every((statement) => statement.startsWith("UPDATE"))
    ).toBe(true);
  });
});
