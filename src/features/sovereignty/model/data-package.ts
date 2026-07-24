import { z } from "zod";

export const CLOUDMIND_DATA_PACKAGE_FORMAT = "cloudmind-data-package";
export const CLOUDMIND_DATA_PACKAGE_VERSION = 2;

export const CLOUDMIND_DATA_TABLES = [
  "asset_artifacts",
  "asset_chunks",
  "asset_sources",
  "assets",
  "auth_accounts",
  "communities",
  "deletion_audits",
  "edges",
  "entities",
  "ingest_jobs",
  "mcp_tokens",
  "provenance",
  "statements",
  "workflow_runs",
  "workflow_steps",
] as const;

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const packagePathSchema = z
  .string()
  .min(1)
  .refine(
    (value) => !value.includes("\\"),
    "Package paths use forward slashes."
  )
  .refine((value) => !value.startsWith("/"), "Package paths are relative.")
  .refine(
    (value) => !value.split("/").includes(".."),
    "Package paths cannot traverse upward."
  );

const packageFileSchema = z.object({
  path: packagePathSchema,
  size: z.number().int().nonnegative(),
  sha256: sha256Schema,
  role: z.enum(["database", "r2_object", "vector_index"]),
});

const r2ObjectSchema = z.object({
  key: z.string().min(1),
  path: packagePathSchema,
  contentType: z.string().min(1).optional(),
});

const databaseTableSchema = z.object({
  name: z.enum(CLOUDMIND_DATA_TABLES),
  path: packagePathSchema,
  count: z.number().int().nonnegative(),
});

const vectorIndexSchema = z.object({
  kind: z.enum(["asset_chunks", "graph_entities"]),
  sourceIndex: z.string().min(1),
  path: packagePathSchema,
  count: z.number().int().nonnegative(),
  requiredMetadataIndexes: z.array(z.string().min(1)),
});

export const cloudMindDataPackageManifestSchema = z.object({
  format: z.literal(CLOUDMIND_DATA_PACKAGE_FORMAT),
  version: z.literal(CLOUDMIND_DATA_PACKAGE_VERSION),
  createdAt: z.iso.datetime(),
  database: z.object({
    tables: z.array(databaseTableSchema).length(CLOUDMIND_DATA_TABLES.length),
    tableCounts: z.record(z.string(), z.number().int().nonnegative()),
  }),
  r2: z.object({
    objects: z.array(r2ObjectSchema),
  }),
  vectorize: z.array(vectorIndexSchema).length(2),
  files: z.array(packageFileSchema),
});

export type CloudMindDataPackageManifest = z.infer<
  typeof cloudMindDataPackageManifestSchema
>;

const findDuplicate = (values: string[]): string | null => {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      return value;
    }

    seen.add(value);
  }

  return null;
};

// 这里同时校验结构和交叉引用，避免合法 JSON 指向包外文件或重复对象。
export const parseDataPackageManifest = (
  input: unknown
): CloudMindDataPackageManifest => {
  const manifest = cloudMindDataPackageManifestSchema.parse(input);
  const duplicateFilePath = findDuplicate(
    manifest.files.map((file) => file.path)
  );

  if (duplicateFilePath) {
    throw new Error(`Duplicate package file path: ${duplicateFilePath}.`);
  }

  const duplicateObjectKey = findDuplicate(
    manifest.r2.objects.map((object) => object.key)
  );

  if (duplicateObjectKey) {
    throw new Error(`Duplicate R2 object key: ${duplicateObjectKey}.`);
  }

  const duplicateTable = findDuplicate(
    manifest.database.tables.map((table) => table.name)
  );

  if (duplicateTable) {
    throw new Error(`Duplicate database table: ${duplicateTable}.`);
  }

  const exportedTables = new Set(
    manifest.database.tables.map((table) => table.name)
  );

  for (const table of CLOUDMIND_DATA_TABLES) {
    if (!exportedTables.has(table)) {
      throw new Error(`Database table is missing from the package: ${table}.`);
    }
  }

  const filePaths = new Set(manifest.files.map((file) => file.path));
  const referencedPaths = [
    ...manifest.database.tables.map((table) => table.path),
    ...manifest.r2.objects.map((object) => object.path),
    ...manifest.vectorize.map((index) => index.path),
  ];

  for (const path of referencedPaths) {
    if (!filePaths.has(path)) {
      throw new Error(`Package manifest references an unlisted file: ${path}.`);
    }
  }

  return manifest;
};

export const getR2PackagePath = (sha256: string): string => {
  const parsedHash = sha256Schema.parse(sha256);

  return `r2/${parsedHash.slice(0, 2)}/${parsedHash}`;
};
