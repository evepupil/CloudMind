import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { z } from "zod";

import type { WranglerMode } from "./options.ts";

const MAX_COMMAND_OUTPUT = 256 * 1024 * 1024;

interface RunWranglerOptions {
  retries?: number | undefined;
}

export const runWrangler = (
  projectRoot: string,
  args: string[],
  options?: RunWranglerOptions
): string => {
  const wranglerPath = resolve(
    projectRoot,
    "node_modules",
    "wrangler",
    "bin",
    "wrangler.js"
  );
  const attempts = (options?.retries ?? 0) + 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = spawnSync(process.execPath, [wranglerPath, ...args], {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: MAX_COMMAND_OUTPUT,
      env: {
        ...process.env,
        CI: "1",
      },
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status === 0) {
      return result.stdout;
    }

    if (attempt === attempts) {
      const operation = args.slice(0, 2).join(" ");
      throw new Error(
        `Wrangler ${operation} failed with exit code ${result.status}.`
      );
    }
  }

  throw new Error("Wrangler retry loop ended unexpectedly.");
};

const findJsonStart = (text: string, offset: number): number => {
  const objectStart = text.indexOf("{", offset);
  const arrayStart = text.indexOf("[", offset);

  if (objectStart === -1) {
    return arrayStart;
  }

  if (arrayStart === -1) {
    return objectStart;
  }

  return Math.min(objectStart, arrayStart);
};

// Wrangler 有些命令会在 JSON 前输出一行进度，这里提取首个括号平衡的 JSON 文档。
export const parseWranglerJson = (text: string): unknown => {
  let start = findJsonStart(text, 0);

  while (start !== -1) {
    const opening = text[start];
    const closing = opening === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const character = text[index];

      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = !inString;
      } else if (!inString && character === opening) {
        depth += 1;
      } else if (!inString && character === closing) {
        depth -= 1;

        if (depth === 0) {
          const candidate = text.slice(start, index + 1);

          try {
            return JSON.parse(candidate) as unknown;
          } catch {
            break;
          }
        }
      }
    }

    start = findJsonStart(text, start + 1);
  }

  throw new Error("Wrangler did not return a valid JSON document.");
};

const d1EnvelopeSchema = z.array(
  z.object({
    results: z.array(z.record(z.string(), z.unknown())),
  })
);

export const queryD1 = (
  projectRoot: string,
  database: string,
  mode: WranglerMode,
  sql: string
): Array<Record<string, unknown>> => {
  const output = runWrangler(
    projectRoot,
    ["d1", "execute", database, `--${mode}`, "--command", sql, "--json"],
    { retries: 2 }
  );
  const envelopes = d1EnvelopeSchema.parse(parseWranglerJson(output));

  return envelopes.flatMap((envelope) => envelope.results);
};
