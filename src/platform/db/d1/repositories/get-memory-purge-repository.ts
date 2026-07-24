import type { MemoryPurgeRepository } from "@/core/sovereignty/ports";
import type { AppBindings } from "@/env";

import { D1MemoryPurgeRepository } from "./d1-memory-purge-repository";

const getDatabaseBinding = (bindings: AppBindings | undefined): D1Database => {
  if (!bindings?.DB) {
    throw new Error('Cloudflare D1 binding "DB" is not configured.');
  }

  return bindings.DB;
};

export const getMemoryPurgeRepositoryFromBindings = (
  bindings: AppBindings | undefined
): MemoryPurgeRepository =>
  new D1MemoryPurgeRepository(getDatabaseBinding(bindings));
