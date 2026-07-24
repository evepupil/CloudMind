import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyRemoteMigrations } from "./check-migrations.ts";
import { checkReleaseVersion } from "./check-version.ts";
import { getCurrentProductionVersion } from "./cloudflare.ts";
import { runWranglerMutation } from "./command.ts";
import { getSmokeBaseUrl } from "./smoke.ts";
import { runProductionSmoke } from "./smoke-core.ts";

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(currentFile), "../..");
const skipSmoke = process.argv.includes("--skip-smoke");
const smokeBaseUrl = skipSmoke ? undefined : getSmokeBaseUrl();

const previousVersionId = getCurrentProductionVersion(projectRoot);
const version = checkReleaseVersion(projectRoot);
let deployed = false;

try {
  runWranglerMutation(projectRoot, "应用远端 D1 migrations", [
    "d1",
    "migrations",
    "apply",
    "DB",
    "--remote",
  ]);
  const migrations = verifyRemoteMigrations(projectRoot);
  console.log(
    `Remote D1 migrations verified before deploy: ${migrations.length}.`
  );

  runWranglerMutation(projectRoot, `发布 CloudMind v${version}`, ["deploy"]);
  deployed = true;

  if (smokeBaseUrl) {
    await runProductionSmoke({ baseUrl: smokeBaseUrl });
    console.log(`Production smoke passed for ${smokeBaseUrl}.`);
  } else {
    console.log(
      "Production smoke skipped for first-time deployment; run it after assigning a public URL."
    );
  }
} catch (error) {
  if (deployed && previousVersionId) {
    console.error("Post-deploy verification failed; rolling back Worker code.");
    runWranglerMutation(projectRoot, "回滚到发布前 Worker 版本", [
      "rollback",
      previousVersionId,
      "--yes",
      "--message",
      `Automatic rollback after failed v${version} smoke`,
    ]);

    if (smokeBaseUrl) {
      await runProductionSmoke({ baseUrl: smokeBaseUrl });
      console.log("Rollback smoke passed.");
    }
  }

  throw error;
}
