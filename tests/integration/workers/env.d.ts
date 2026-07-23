/// <reference types="@cloudflare/vitest-pool-workers/types" />

interface CloudflareBindings {
  DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
}

declare namespace Cloudflare {
  interface Env extends CloudflareBindings {}
}
