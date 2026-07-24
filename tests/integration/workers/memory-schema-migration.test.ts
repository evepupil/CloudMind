import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("M3 memory schema migration", () => {
  it("preserves asset provenance before removing episodes", async () => {
    const migrations = env.TEST_MIGRATIONS;
    const removalMigration = migrations.at(-1);

    expect(removalMigration?.name).toContain("0016");
    await applyD1Migrations(env.MIGRATION_DB, migrations.slice(0, -1));

    const now = new Date().toISOString();
    await env.MIGRATION_DB.batch([
      env.MIGRATION_DB.prepare(
        "INSERT INTO assets " +
          "(id, type, title, status, record_kind, scope_id, context_key, created_at, updated_at) " +
          "VALUES ('asset-1', 'note', 'Memory', 'ready', 'memory', 'agent', 'project:github:evepupil/CloudMind', ?, ?)"
      ).bind(now, now),
      env.MIGRATION_DB.prepare(
        "INSERT INTO episodes " +
          "(id, scope_id, kind, asset_id, recorded_at, created_at) " +
          "VALUES ('episode-1', 'agent', 'ingest', 'asset-1', ?, ?)"
      ).bind(now, now),
      env.MIGRATION_DB.prepare(
        "INSERT INTO provenance " +
          "(id, scope_id, context_key, record_kind, memory_type, memory_id, episode_id, asset_id, chunk_index, created_at) " +
          "VALUES ('provenance-1', 'agent', 'project:github:evepupil/CloudMind', 'memory', 'statement', 'statement-1', 'episode-1', 'asset-1', 3, ?)"
      ).bind(now),
    ]);

    if (!removalMigration) {
      throw new Error("Missing episode removal migration.");
    }

    await applyD1Migrations(env.MIGRATION_DB, [removalMigration]);

    const provenance = await env.MIGRATION_DB.prepare(
      "SELECT asset_id, chunk_index, scope_id, context_key, record_kind FROM provenance WHERE id = 'provenance-1'"
    ).first<{
      asset_id: string;
      chunk_index: number;
      scope_id: string;
      context_key: string;
      record_kind: string;
    }>();
    const episodeTable = await env.MIGRATION_DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'episodes'"
    ).first<{ name: string }>();

    expect(provenance).toEqual({
      asset_id: "asset-1",
      chunk_index: 3,
      scope_id: "agent",
      context_key: "project:github:evepupil/CloudMind",
      record_kind: "memory",
    });
    expect(episodeTable).toBeNull();
  });
});
