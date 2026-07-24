import type { CloudMindDataPackageManifest } from "../../../src/features/sovereignty/model/data-package.ts";
import { restoreDatabase } from "./restore-database.ts";
import { restoreR2Objects } from "./restore-r2.ts";
import {
  assertVectorMetadataIndexes,
  restoreVectorIndexes,
} from "./restore-vectorize.ts";
import type { RestoreDataPackageInput } from "./types.ts";
import { readAndValidateDataPackage } from "./validate.ts";

export const restoreDataPackage = async (
  input: RestoreDataPackageInput
): Promise<CloudMindDataPackageManifest> => {
  if (!input.confirmEmptyTarget) {
    throw new Error(
      "Restore requires --confirm-empty-target after provisioning isolated resources."
    );
  }

  const manifest = await readAndValidateDataPackage(input.packagePath);
  assertVectorMetadataIndexes(input, manifest);
  await restoreDatabase(input, manifest);
  restoreR2Objects(input, manifest);
  restoreVectorIndexes(input, manifest);

  return manifest;
};
