import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

import {
  type CloudMindDataPackageManifest,
  getR2PackagePath,
} from "../../../src/features/sovereignty/model/data-package.ts";
import { mapWithConcurrency } from "./concurrency.ts";
import { resolvePackageFile } from "./file-integrity.ts";
import type { ExportDataPackageInput } from "./types.ts";
import { queryD1, runWrangler } from "./wrangler.ts";

const PAGE_SIZE = 100;
const r2ReferenceSchema = z.object({
  key: z.string().min(1),
  content_type: z.string().nullable(),
});

const escapeSqlLiteral = (value: string): string => value.replaceAll("'", "''");

const buildR2ReferenceSql = (cursor: string | null): string => {
  const cursorCondition = cursor
    ? `AND key > '${escapeSqlLiteral(cursor)}'`
    : "";

  return [
    "SELECT key, MAX(content_type) AS content_type",
    "FROM (",
    "  SELECT raw_r2_key AS key, mime_type AS content_type FROM assets",
    "  UNION ALL",
    "  SELECT content_r2_key AS key, 'text/plain; charset=utf-8' AS content_type FROM assets",
    "  UNION ALL",
    "  SELECT r2_key AS key, NULL AS content_type FROM asset_artifacts",
    ")",
    "WHERE key IS NOT NULL AND TRIM(key) <> ''",
    cursorCondition,
    "GROUP BY key",
    "ORDER BY key",
    `LIMIT ${PAGE_SIZE}`,
  ]
    .filter(Boolean)
    .join("\n");
};

export const exportR2Objects = async (
  input: ExportDataPackageInput
): Promise<CloudMindDataPackageManifest["r2"]["objects"]> => {
  const objects: CloudMindDataPackageManifest["r2"]["objects"] = [];
  let cursor: string | null = null;

  while (true) {
    const page: z.infer<typeof r2ReferenceSchema>[] = queryD1(
      input.projectRoot,
      input.resources.database,
      input.mode,
      buildR2ReferenceSql(cursor)
    ).map((row) => r2ReferenceSchema.parse(row));

    const exportedPage = await mapWithConcurrency(page, 4, async (object) => {
      const keyHash = createHash("sha256").update(object.key).digest("hex");
      const packagePath = getR2PackagePath(keyHash);
      const targetPath = resolvePackageFile(input.outputPath, packagePath);

      await mkdir(dirname(targetPath), { recursive: true });
      runWrangler(
        input.projectRoot,
        [
          "r2",
          "object",
          "get",
          `${input.resources.bucket}/${object.key}`,
          `--${input.mode}`,
          "--file",
          targetPath,
        ],
        { retries: 2 }
      );

      return {
        key: object.key,
        path: packagePath,
        ...(object.content_type ? { contentType: object.content_type } : {}),
      };
    });
    objects.push(...exportedPage);

    if (page.length < PAGE_SIZE) {
      return objects;
    }

    cursor = page.at(-1)?.key ?? null;
  }
};
