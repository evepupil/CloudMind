import { resolve } from "node:path";

import { exportDataPackage } from "./data-package/export.ts";
import {
  loadConfiguredResourceNames,
  parseDataPackageCliOptions,
  resolveResourceNames,
} from "./data-package/options.ts";
import { restoreDataPackage } from "./data-package/restore.ts";
import { readAndValidateDataPackage } from "./data-package/validate.ts";

const printUsage = (): void => {
  console.log(`CloudMind data package

Usage:
  node scripts/ops/cloudmind-data.ts export --output <dir> --remote
  node scripts/ops/cloudmind-data.ts validate --package <dir>
  node scripts/ops/cloudmind-data.ts restore --package <dir> --remote \\
    --database <fresh-d1> --bucket <fresh-r2> \\
    --asset-index <fresh-vectorize> --graph-index <fresh-vectorize> \\
    --confirm-empty-target [--resume]
`);
};

const main = async (): Promise<void> => {
  if (process.argv.length <= 2 || process.argv.includes("--help")) {
    printUsage();
    return;
  }

  const projectRoot = resolve(import.meta.dirname, "..", "..");
  const options = parseDataPackageCliOptions(process.argv.slice(2));

  if (options.command === "validate") {
    const manifest = await readAndValidateDataPackage(options.packagePath);
    console.log(
      `Data package is valid: ${manifest.files.length} files, ${manifest.r2.objects.length} R2 objects.`
    );
    return;
  }

  if (options.mode !== "remote") {
    throw new Error(
      "Full data packages currently require --remote because Vectorize has no local index."
    );
  }

  const configured = await loadConfiguredResourceNames(projectRoot);
  const resources = resolveResourceNames(options, configured);

  if (options.command === "export") {
    const manifest = await exportDataPackage({
      projectRoot,
      outputPath: options.packagePath,
      mode: options.mode,
      resources,
    });
    console.log(
      `Export complete: ${manifest.files.length} files, ${manifest.r2.objects.length} R2 objects.`
    );
    return;
  }

  const manifest = await restoreDataPackage({
    projectRoot,
    packagePath: options.packagePath,
    mode: options.mode,
    resources,
    resume: options.resume,
    confirmEmptyTarget: options.confirmEmptyTarget,
  });
  console.log(
    `Restore complete: ${manifest.files.length} files, ${manifest.r2.objects.length} R2 objects.`
  );
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown failure.";
  console.error(`CloudMind data operation failed: ${message}`);
  process.exitCode = 1;
});
