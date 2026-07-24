import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runProductionSmoke } from "./smoke-core.ts";

export const getSmokeBaseUrl = (): string => {
  const value = process.env.SMOKE_BASE_URL?.trim();

  if (!value) {
    throw new Error("SMOKE_BASE_URL is required for a production release.");
  }

  return value;
};

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  await runProductionSmoke({ baseUrl: getSmokeBaseUrl() });
  console.log(`Production smoke passed for ${getSmokeBaseUrl()}.`);
}
