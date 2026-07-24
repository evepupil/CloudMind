import { mkdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  CLOUDMIND_DATA_PACKAGE_FORMAT,
  CLOUDMIND_DATA_PACKAGE_VERSION,
  type CloudMindDataPackageManifest,
  parseDataPackageManifest,
} from "../../../src/features/sovereignty/model/data-package.ts";
import { exportDatabase } from "./export-database.ts";
import { exportR2Objects } from "./export-r2.ts";
import {
  ASSET_METADATA_INDEXES,
  ASSET_VECTOR_PACKAGE_PATH,
  exportVectorIndex,
  GRAPH_METADATA_INDEXES,
  GRAPH_VECTOR_PACKAGE_PATH,
} from "./export-vectorize.ts";
import { hashFile, resolvePackageFile } from "./file-integrity.ts";
import type { ExportDataPackageInput } from "./types.ts";

const assertOutputDoesNotExist = async (outputPath: string): Promise<void> => {
  try {
    await stat(outputPath);
    throw new Error(`Export destination already exists: ${outputPath}.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
};

const buildFileEntries = async (
  outputPath: string,
  databaseTables: CloudMindDataPackageManifest["database"]["tables"],
  r2Objects: CloudMindDataPackageManifest["r2"]["objects"]
): Promise<CloudMindDataPackageManifest["files"]> => {
  const paths: Array<{
    path: string;
    role: "database" | "r2_object" | "vector_index";
  }> = [
    ...databaseTables.map((table) => ({
      path: table.path,
      role: "database" as const,
    })),
    ...r2Objects.map((object) => ({
      path: object.path,
      role: "r2_object" as const,
    })),
    { path: ASSET_VECTOR_PACKAGE_PATH, role: "vector_index" },
    { path: GRAPH_VECTOR_PACKAGE_PATH, role: "vector_index" },
  ];

  return Promise.all(
    paths.map(async (file) => ({
      ...file,
      ...(await hashFile(resolvePackageFile(outputPath, file.path))),
    }))
  );
};

export const exportDataPackage = async (
  input: ExportDataPackageInput
): Promise<CloudMindDataPackageManifest> => {
  await assertOutputDoesNotExist(input.outputPath);
  await mkdir(input.outputPath, { recursive: true, mode: 0o700 });
  const database = await exportDatabase(input);
  const r2Objects = await exportR2Objects(input);
  const assetVectorCount = await exportVectorIndex(
    input.projectRoot,
    input.resources.assetIndex,
    resolvePackageFile(input.outputPath, ASSET_VECTOR_PACKAGE_PATH)
  );
  const graphVectorCount = await exportVectorIndex(
    input.projectRoot,
    input.resources.graphIndex,
    resolvePackageFile(input.outputPath, GRAPH_VECTOR_PACKAGE_PATH)
  );
  const manifest = parseDataPackageManifest({
    format: CLOUDMIND_DATA_PACKAGE_FORMAT,
    version: CLOUDMIND_DATA_PACKAGE_VERSION,
    createdAt: new Date().toISOString(),
    database,
    r2: { objects: r2Objects },
    vectorize: [
      {
        kind: "asset_chunks",
        sourceIndex: input.resources.assetIndex,
        path: ASSET_VECTOR_PACKAGE_PATH,
        count: assetVectorCount,
        requiredMetadataIndexes: ASSET_METADATA_INDEXES,
      },
      {
        kind: "graph_entities",
        sourceIndex: input.resources.graphIndex,
        path: GRAPH_VECTOR_PACKAGE_PATH,
        count: graphVectorCount,
        requiredMetadataIndexes: GRAPH_METADATA_INDEXES,
      },
    ],
    files: await buildFileEntries(input.outputPath, database.tables, r2Objects),
  });

  await writeFile(
    resolve(input.outputPath, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 }
  );

  return manifest;
};
