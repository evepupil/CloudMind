import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { validateReleaseMetadata } from "./model.ts";

const packageSchema = z.object({
  version: z.string(),
});

export const checkReleaseVersion = (projectRoot: string): string => {
  const packageJson = packageSchema.parse(
    JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"))
  );
  const changelog = readFileSync(resolve(projectRoot, "CHANGELOG.md"), "utf8");

  validateReleaseMetadata(packageJson.version, changelog);
  return packageJson.version;
};

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  const projectRoot = resolve(dirname(currentFile), "../..");
  const version = checkReleaseVersion(projectRoot);
  console.log(`Release metadata valid for v${version}.`);
}
