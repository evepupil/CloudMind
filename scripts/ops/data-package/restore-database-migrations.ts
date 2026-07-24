import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";

import type { RestoreDataPackageInput } from "./types.ts";
import { parseWranglerJson, runWrangler } from "./wrangler.ts";

const d1InfoSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string().min(1),
});

interface RestoreWranglerConfigInput {
  databaseId: string;
  databaseName: string;
  migrationsDirectory: string;
}

export const buildRestoreWranglerConfig = (
  input: RestoreWranglerConfigInput
): string =>
  JSON.stringify(
    {
      name: "cloudmind-data-restore",
      compatibility_date: "2026-07-24",
      d1_databases: [
        {
          binding: "RESTORE_DB",
          database_name: input.databaseName,
          database_id: input.databaseId,
          migrations_dir: input.migrationsDirectory,
        },
      ],
    },
    null,
    2
  );

// migrations apply 只接受 Wrangler 配置中的绑定，因此为隔离目标生成一次性配置。
export const applyDatabaseMigrations = async (
  input: RestoreDataPackageInput
): Promise<void> => {
  const info = d1InfoSchema.parse(
    parseWranglerJson(
      runWrangler(input.projectRoot, [
        "d1",
        "info",
        input.resources.database,
        "--json",
      ])
    )
  );

  if (info.name !== input.resources.database) {
    throw new Error("Wrangler resolved a different D1 restore target.");
  }

  const workingDirectory = await mkdtemp(
    join(tmpdir(), "cloudmind-d1-migrations-")
  );
  const configPath = join(workingDirectory, "wrangler.json");

  try {
    await writeFile(
      configPath,
      buildRestoreWranglerConfig({
        databaseId: info.uuid,
        databaseName: info.name,
        migrationsDirectory: resolve(input.projectRoot, "drizzle"),
      }),
      "utf8"
    );
    runWrangler(input.projectRoot, [
      "d1",
      "migrations",
      "apply",
      "RESTORE_DB",
      `--${input.mode}`,
      "--config",
      configPath,
    ]);
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
};
