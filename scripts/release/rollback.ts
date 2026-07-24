import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getProductionRollbackPair } from "./cloudflare.ts";
import { runWranglerMutation } from "./command.ts";
import { getSmokeBaseUrl } from "./smoke.ts";
import { runProductionSmoke } from "./smoke-core.ts";

const getArgument = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(currentFile), "../..");
const smokeBaseUrl = getSmokeBaseUrl();

const rollbackTo = async (
  versionId: string,
  message: string
): Promise<void> => {
  runWranglerMutation(projectRoot, `切换 Worker 到 ${versionId}`, [
    "rollback",
    versionId,
    "--yes",
    "--message",
    message,
  ]);
  await runProductionSmoke({ baseUrl: smokeBaseUrl });
  console.log(`Rollback smoke passed for ${versionId}.`);
};

if (process.argv.includes("--rehearse")) {
  const pair = getProductionRollbackPair(projectRoot);
  let restored = false;

  try {
    await rollbackTo(
      pair.previousVersionId,
      `M7 rollback rehearsal from ${pair.currentVersionId}`
    );
    await rollbackTo(
      pair.currentVersionId,
      `M7 rollback rehearsal restore ${pair.currentVersionId}`
    );
    restored = true;
    console.log(
      "Production rollback rehearsal passed and current version restored."
    );
  } finally {
    if (!restored) {
      console.error(
        "Rollback rehearsal interrupted; restoring the starting version."
      );
      await rollbackTo(
        pair.currentVersionId,
        `M7 rollback rehearsal recovery ${pair.currentVersionId}`
      );
    }
  }
} else {
  const versionId = getArgument("--version");

  if (!versionId) {
    throw new Error("Pass --version <worker-version-id> or --rehearse.");
  }

  await rollbackTo(versionId, `Manual CloudMind rollback to ${versionId}`);
}
