import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  type CloudMindDataPackageManifest,
  parseDataPackageManifest,
} from "../../../src/features/sovereignty/model/data-package.ts";
import { hashFile, resolvePackageFile } from "./file-integrity.ts";

export const readAndValidateDataPackage = async (
  packageRoot: string
): Promise<CloudMindDataPackageManifest> => {
  const manifestPath = resolve(packageRoot, "manifest.json");
  const manifest = parseDataPackageManifest(
    JSON.parse(await readFile(manifestPath, "utf8")) as unknown
  );

  for (const file of manifest.files) {
    const filePath = resolvePackageFile(packageRoot, file.path);
    const actual = await hashFile(filePath);

    if (actual.size !== file.size || actual.sha256 !== file.sha256) {
      throw new Error(`Checksum validation failed for ${file.path}.`);
    }
  }

  return manifest;
};
