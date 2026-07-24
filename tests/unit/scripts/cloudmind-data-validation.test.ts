import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readAndValidateDataPackage } from "../../../scripts/ops/data-package/validate";

const temporaryDirectories: string[] = [];
const hash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const createPackage = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "cloudmind-package-"));
  temporaryDirectories.push(root);
  const contents = {
    "database/database.sql": "CREATE TABLE example (id TEXT);\n",
    "vectorize/asset-chunks.ndjson": "",
    "vectorize/graph-entities.ndjson": "",
  };

  for (const [path, content] of Object.entries(contents)) {
    const filePath = join(root, ...path.split("/"));
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
  }

  await writeFile(
    join(root, "manifest.json"),
    JSON.stringify({
      format: "cloudmind-data-package",
      version: 1,
      createdAt: "2026-07-24T08:00:00.000Z",
      database: {
        path: "database/database.sql",
        tableCounts: { assets: 0 },
      },
      r2: { objects: [] },
      vectorize: [
        {
          kind: "asset_chunks",
          sourceIndex: "asset-index",
          path: "vectorize/asset-chunks.ndjson",
          count: 0,
          requiredMetadataIndexes: [],
        },
        {
          kind: "graph_entities",
          sourceIndex: "graph-index",
          path: "vectorize/graph-entities.ndjson",
          count: 0,
          requiredMetadataIndexes: [],
        },
      ],
      files: Object.entries(contents).map(([path, content]) => ({
        path,
        size: Buffer.byteLength(content),
        sha256: hash(content),
        role: path.startsWith("database") ? "database" : "vector_index",
      })),
    }),
    "utf8"
  );

  return root;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true }))
  );
});

describe("CloudMind data package validation", () => {
  it("validates every listed file", async () => {
    const root = await createPackage();

    await expect(readAndValidateDataPackage(root)).resolves.toMatchObject({
      version: 1,
      files: expect.arrayContaining([
        expect.objectContaining({ path: "database/database.sql" }),
      ]),
    });
  });

  it("detects a modified package file", async () => {
    const root = await createPackage();
    await writeFile(join(root, "database", "database.sql"), "changed", "utf8");

    await expect(readAndValidateDataPackage(root)).rejects.toThrow(
      "Checksum validation failed"
    );
  });
});
