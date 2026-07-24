import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "jsonc-parser";
import { z } from "zod";

export type DataPackageCommand = "export" | "restore" | "validate";
export type WranglerMode = "local" | "remote";

export interface DataPackageCliOptions {
  command: DataPackageCommand;
  packagePath: string;
  mode?: WranglerMode | undefined;
  database?: string | undefined;
  bucket?: string | undefined;
  assetIndex?: string | undefined;
  graphIndex?: string | undefined;
  resume: boolean;
  confirmEmptyTarget: boolean;
}

export interface CloudMindResourceNames {
  database: string;
  bucket: string;
  assetIndex: string;
  graphIndex: string;
}

const commandSchema = z.enum(["export", "restore", "validate"]);
const configSchema = z.object({
  d1_databases: z
    .array(
      z.object({
        binding: z.string(),
        database_name: z.string(),
      })
    )
    .optional(),
  r2_buckets: z
    .array(
      z.object({
        binding: z.string(),
        bucket_name: z.string(),
      })
    )
    .optional(),
  vectorize: z
    .array(
      z.object({
        binding: z.string(),
        index_name: z.string(),
      })
    )
    .optional(),
});

const readFlagValue = (args: string[], index: number): string => {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${args[index] ?? "option"}.`);
  }

  return value;
};

export const parseDataPackageCliOptions = (
  args: string[]
): DataPackageCliOptions => {
  const command = commandSchema.parse(args[0]);
  let packagePath = "";
  let mode: WranglerMode | undefined;
  let database: string | undefined;
  let bucket: string | undefined;
  let assetIndex: string | undefined;
  let graphIndex: string | undefined;
  let resume = false;
  let confirmEmptyTarget = false;

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--package" || argument === "--output") {
      packagePath = readFlagValue(args, index);
      index += 1;
    } else if (argument === "--remote" || argument === "--local") {
      const nextMode = argument.slice(2) as WranglerMode;

      if (mode && mode !== nextMode) {
        throw new Error("Choose exactly one of --remote or --local.");
      }

      mode = nextMode;
    } else if (argument === "--database") {
      database = readFlagValue(args, index);
      index += 1;
    } else if (argument === "--bucket") {
      bucket = readFlagValue(args, index);
      index += 1;
    } else if (argument === "--asset-index") {
      assetIndex = readFlagValue(args, index);
      index += 1;
    } else if (argument === "--graph-index") {
      graphIndex = readFlagValue(args, index);
      index += 1;
    } else if (argument === "--resume") {
      resume = true;
    } else if (argument === "--confirm-empty-target") {
      confirmEmptyTarget = true;
    } else {
      throw new Error(`Unknown option: ${argument}.`);
    }
  }

  if (!packagePath) {
    throw new Error(
      "Provide --output for export or --package for validation/restore."
    );
  }

  if (command !== "validate" && !mode) {
    throw new Error("Choose --remote or --local explicitly.");
  }

  return {
    command,
    packagePath: resolve(packagePath),
    mode,
    database,
    bucket,
    assetIndex,
    graphIndex,
    resume,
    confirmEmptyTarget,
  };
};

export const loadConfiguredResourceNames = async (
  projectRoot: string
): Promise<CloudMindResourceNames> => {
  const configText = await readFile(
    resolve(projectRoot, "wrangler.jsonc"),
    "utf8"
  );
  const config = configSchema.parse(parse(configText));
  const database = config.d1_databases?.find(
    (entry) => entry.binding === "DB"
  )?.database_name;
  const bucket = config.r2_buckets?.find(
    (entry) => entry.binding === "ASSET_FILES"
  )?.bucket_name;
  const assetIndex = config.vectorize?.find(
    (entry) => entry.binding === "ASSET_VECTORS"
  )?.index_name;
  const graphIndex = config.vectorize?.find(
    (entry) => entry.binding === "GRAPH_VECTORS"
  )?.index_name;

  if (!database || !bucket || !assetIndex || !graphIndex) {
    throw new Error(
      "wrangler.jsonc is missing a required CloudMind resource binding."
    );
  }

  return { database, bucket, assetIndex, graphIndex };
};

export const resolveResourceNames = (
  options: DataPackageCliOptions,
  configured: CloudMindResourceNames
): CloudMindResourceNames => {
  if (options.command === "restore") {
    if (
      !options.database ||
      !options.bucket ||
      !options.assetIndex ||
      !options.graphIndex
    ) {
      throw new Error(
        "Restore requires explicit --database, --bucket, --asset-index, and --graph-index."
      );
    }

    return {
      database: options.database,
      bucket: options.bucket,
      assetIndex: options.assetIndex,
      graphIndex: options.graphIndex,
    };
  }

  return {
    database: options.database ?? configured.database,
    bucket: options.bucket ?? configured.bucket,
    assetIndex: options.assetIndex ?? configured.assetIndex,
    graphIndex: options.graphIndex ?? configured.graphIndex,
  };
};
