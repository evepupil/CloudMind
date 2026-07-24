import type { CloudMindDataPackageManifest } from "../../../src/features/sovereignty/model/data-package.ts";
import { resolvePackageFile } from "./file-integrity.ts";
import type { RestoreDataPackageInput } from "./types.ts";
import { runWrangler } from "./wrangler.ts";

export const restoreR2Objects = (
  input: RestoreDataPackageInput,
  manifest: CloudMindDataPackageManifest
): void => {
  for (const object of manifest.r2.objects) {
    const args = [
      "r2",
      "object",
      "put",
      `${input.resources.bucket}/${object.key}`,
      `--${input.mode}`,
      "--file",
      resolvePackageFile(input.packagePath, object.path),
      "--force",
    ];

    if (object.contentType) {
      args.push("--content-type", object.contentType);
    }

    runWrangler(input.projectRoot, args);
  }
};
