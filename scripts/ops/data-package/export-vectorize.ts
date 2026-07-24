import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

import { mapWithConcurrency } from "./concurrency.ts";
import { parseWranglerJson, runWrangler } from "./wrangler.ts";

export const ASSET_VECTOR_PACKAGE_PATH = "vectorize/asset-chunks.ndjson";
export const GRAPH_VECTOR_PACKAGE_PATH = "vectorize/graph-entities.ndjson";
export const ASSET_METADATA_INDEXES = [
  "aiVisibility",
  "domain",
  "sourceKind",
  "sourceHost",
  "collectionKey",
  "type",
  "scopeId",
  "recordKind",
  "contextKey",
  "createdAt",
];
export const GRAPH_METADATA_INDEXES = ["scopeId", "contextKey"];

const VECTOR_GET_BATCH_SIZE = 20;
const vectorListSchema = z.object({
  vectors: z.array(z.object({ id: z.string().min(1) })),
  isTruncated: z.boolean(),
  nextCursor: z.string().optional(),
});
const vectorSchema = z
  .object({
    id: z.string().min(1),
    values: z.array(z.number()),
    metadata: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
    namespace: z.string().nullable().optional(),
  })
  .transform(({ namespace, ...vector }) => ({
    ...vector,
    ...(namespace ? { namespace } : {}),
  }));

const parseVectors = (output: string): z.infer<typeof vectorSchema>[] => {
  const raw = parseWranglerJson(output);
  const candidates = Array.isArray(raw)
    ? raw
    : z.object({ vectors: z.array(z.unknown()) }).parse(raw).vectors;

  return candidates.map((candidate) => vectorSchema.parse(candidate));
};

export const buildVectorIdArgs = (ids: string[]): string[] =>
  ids.flatMap((id) => ["--ids", id]);

export const exportVectorIndex = async (
  projectRoot: string,
  indexName: string,
  outputPath: string
): Promise<number> => {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, "", "utf8");
  let cursor: string | undefined;
  let count = 0;

  while (true) {
    const listArgs = [
      "vectorize",
      "list-vectors",
      indexName,
      "--count",
      "1000",
      "--json",
    ];

    if (cursor) {
      listArgs.push("--cursor", cursor);
    }

    const page: z.infer<typeof vectorListSchema> = vectorListSchema.parse(
      parseWranglerJson(runWrangler(projectRoot, listArgs, { retries: 2 }))
    );

    const batches = Array.from(
      { length: Math.ceil(page.vectors.length / VECTOR_GET_BATCH_SIZE) },
      (_, index) =>
        page.vectors
          .slice(
            index * VECTOR_GET_BATCH_SIZE,
            (index + 1) * VECTOR_GET_BATCH_SIZE
          )
          .map((vector) => vector.id)
    );
    const vectorBatches = await mapWithConcurrency(batches, 3, async (ids) => {
      const vectors = parseVectors(
        runWrangler(
          projectRoot,
          ["vectorize", "get-vectors", indexName, ...buildVectorIdArgs(ids)],
          { retries: 2 }
        )
      );

      if (vectors.length !== ids.length) {
        throw new Error(
          `Vectorize returned an incomplete page for ${indexName}.`
        );
      }

      return vectors;
    });
    const vectors = vectorBatches.flat();

    if (vectors.length > 0) {
      await appendFile(
        outputPath,
        `${vectors.map((vector) => JSON.stringify(vector)).join("\n")}\n`,
        "utf8"
      );
      count += vectors.length;
    }

    if (!page.isTruncated) {
      return count;
    }

    if (!page.nextCursor || page.nextCursor === cursor) {
      throw new Error(`Vectorize pagination stalled for ${indexName}.`);
    }

    cursor = page.nextCursor;
  }
};
