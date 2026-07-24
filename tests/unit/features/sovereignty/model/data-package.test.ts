import { describe, expect, it } from "vitest";

import {
  CLOUDMIND_DATA_PACKAGE_FORMAT,
  CLOUDMIND_DATA_PACKAGE_VERSION,
  CLOUDMIND_DATA_TABLES,
  parseDataPackageManifest,
} from "@/features/sovereignty/model/data-package";
import { resolveDatabaseRestoreAction } from "@/features/sovereignty/model/restore-policy";

const SHA256 = "a".repeat(64);
const databaseTables = CLOUDMIND_DATA_TABLES.map((name) => ({
  name,
  path: `database/tables/${name}.ndjson`,
  count: name === "assets" ? 2 : name === "asset_chunks" ? 3 : 0,
}));
const tableCounts = Object.fromEntries(
  databaseTables.map((table) => [table.name, table.count])
);

const createManifest = () =>
  parseDataPackageManifest({
    format: CLOUDMIND_DATA_PACKAGE_FORMAT,
    version: CLOUDMIND_DATA_PACKAGE_VERSION,
    createdAt: "2026-07-24T08:00:00.000Z",
    database: {
      tables: databaseTables,
      tableCounts,
    },
    r2: {
      objects: [
        {
          key: "assets/a/raw/input.txt",
          path: "r2/aa/asset",
          contentType: "text/plain; charset=utf-8",
        },
      ],
    },
    vectorize: [
      {
        kind: "asset_chunks",
        sourceIndex: "asset-index",
        path: "vectorize/asset-chunks.ndjson",
        count: 3,
        requiredMetadataIndexes: ["scopeId", "contextKey"],
      },
      {
        kind: "graph_entities",
        sourceIndex: "graph-index",
        path: "vectorize/graph-entities.ndjson",
        count: 1,
        requiredMetadataIndexes: ["scopeId", "contextKey"],
      },
    ],
    files: [
      ...databaseTables.map((table) => ({
        path: table.path,
        size: 10,
        sha256: SHA256,
        role: "database" as const,
      })),
      {
        path: "r2/aa/asset",
        size: 20,
        sha256: SHA256,
        role: "r2_object",
      },
      {
        path: "vectorize/asset-chunks.ndjson",
        size: 30,
        sha256: SHA256,
        role: "vector_index",
      },
      {
        path: "vectorize/graph-entities.ndjson",
        size: 40,
        sha256: SHA256,
        role: "vector_index",
      },
    ],
  });

describe("CloudMind data package manifest", () => {
  it("accepts a complete versioned manifest", () => {
    const manifest = createManifest();

    expect(manifest.version).toBe(2);
    expect(manifest.r2.objects).toHaveLength(1);
  });

  it("rejects paths that escape the package root", () => {
    const manifest = createManifest();

    expect(() =>
      parseDataPackageManifest({
        ...manifest,
        database: {
          ...manifest.database,
          tables: manifest.database.tables.map((table, index) =>
            index === 0 ? { ...table, path: "../database.ndjson" } : table
          ),
        },
      })
    ).toThrow("Package paths cannot traverse upward");
  });

  it("rejects an object whose file is absent from the checksum list", () => {
    const manifest = createManifest();

    expect(() =>
      parseDataPackageManifest({
        ...manifest,
        r2: {
          objects: [
            {
              key: "assets/b/raw/input.txt",
              path: "r2/bb/missing",
            },
          ],
        },
      })
    ).toThrow("references an unlisted file");
  });
});

describe("database restore policy", () => {
  it("imports into a fresh database", () => {
    expect(
      resolveDatabaseRestoreAction({
        existingTableCounts: {},
        manifest: createManifest(),
        resume: false,
      })
    ).toBe("import");
  });

  it("allows an exact retry only with resume enabled", () => {
    const manifest = createManifest();
    const existingTableCounts = manifest.database.tableCounts;

    expect(
      resolveDatabaseRestoreAction({
        existingTableCounts,
        manifest,
        resume: true,
      })
    ).toBe("skip");
    expect(() =>
      resolveDatabaseRestoreAction({
        existingTableCounts,
        manifest,
        resume: false,
      })
    ).toThrow("already contains CloudMind tables");
  });

  it("rejects a retry against different data", () => {
    expect(() =>
      resolveDatabaseRestoreAction({
        existingTableCounts: {
          ...createManifest().database.tableCounts,
          assets: 1,
        },
        manifest: createManifest(),
        resume: true,
      })
    ).toThrow("does not match the package manifest");
  });
});
