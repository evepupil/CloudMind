import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseWranglerJson,
  runWrangler,
} from "../ops/data-package/wrangler.ts";
import {
  assertMigrationNamesMatch,
  readAppliedMigrationNames,
} from "./model.ts";

export const listLocalMigrationNames = (projectRoot: string): string[] =>
  readdirSync(resolve(projectRoot, "drizzle"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();

export const verifyRemoteMigrations = (projectRoot: string): string[] => {
  const expected = listLocalMigrationNames(projectRoot);
  const output = runWrangler(
    projectRoot,
    [
      "d1",
      "execute",
      "DB",
      "--remote",
      "--command",
      "SELECT name FROM d1_migrations ORDER BY id",
      "--json",
    ],
    { retries: 2 }
  );
  const applied = readAppliedMigrationNames(parseWranglerJson(output));

  assertMigrationNamesMatch(expected, applied);
  return applied;
};

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  const projectRoot = resolve(dirname(currentFile), "../..");
  const applied = verifyRemoteMigrations(projectRoot);
  console.log(
    `Remote D1 migrations verified: ${applied.length} applied, latest=${applied.at(-1)}.`
  );
}
