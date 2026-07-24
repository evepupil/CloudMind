import { z } from "zod";

import type { CloudMindDataPackageManifest } from "../../../src/features/sovereignty/model/data-package.ts";
import { resolvePackageFile } from "./file-integrity.ts";
import type { RestoreDataPackageInput } from "./types.ts";
import { parseWranglerJson, runWrangler } from "./wrangler.ts";

const metadataIndexSchema = z.object({ propertyName: z.string() });

const readMetadataIndexes = (
  projectRoot: string,
  indexName: string
): Set<string> => {
  const output = runWrangler(projectRoot, [
    "vectorize",
    "list-metadata-index",
    indexName,
    "--json",
  ]);
  const raw = parseWranglerJson(output);
  const candidates = Array.isArray(raw)
    ? raw
    : z.object({ metadataIndexes: z.array(z.unknown()) }).parse(raw)
        .metadataIndexes;

  return new Set(
    candidates.map(
      (candidate) => metadataIndexSchema.parse(candidate).propertyName
    )
  );
};

export const assertVectorMetadataIndexes = (
  input: RestoreDataPackageInput,
  manifest: CloudMindDataPackageManifest
): void => {
  for (const index of manifest.vectorize) {
    const targetName =
      index.kind === "asset_chunks"
        ? input.resources.assetIndex
        : input.resources.graphIndex;
    const actual = readMetadataIndexes(input.projectRoot, targetName);
    const missing = index.requiredMetadataIndexes.filter(
      (propertyName) => !actual.has(propertyName)
    );

    if (missing.length > 0) {
      throw new Error(
        `Vectorize index ${targetName} is missing metadata indexes: ${missing.join(", ")}.`
      );
    }
  }
};

export const restoreVectorIndexes = (
  input: RestoreDataPackageInput,
  manifest: CloudMindDataPackageManifest
): void => {
  for (const index of manifest.vectorize) {
    if (index.count === 0) {
      continue;
    }

    const targetName =
      index.kind === "asset_chunks"
        ? input.resources.assetIndex
        : input.resources.graphIndex;
    runWrangler(input.projectRoot, [
      "vectorize",
      "upsert",
      targetName,
      "--file",
      resolvePackageFile(input.packagePath, index.path),
      "--json",
    ]);
  }
};
