import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { D1AssetRepository } from "@/platform/db/d1/repositories/d1-asset-repository";

describe("M3 memory schema migration", () => {
  it("preserves asset provenance before removing episodes", async () => {
    const migrations = env.TEST_MIGRATIONS;
    const removalIndex = migrations.findIndex((migration) =>
      migration.name.includes("0016")
    );
    const removalMigration = migrations[removalIndex];

    expect(removalMigration?.name).toContain("0016");
    await applyD1Migrations(
      env.MIGRATION_DB,
      migrations.slice(0, removalIndex)
    );

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

  it("activates a ready successor and supersedes its previous version atomically", async () => {
    const lifecycleMigration = env.TEST_MIGRATIONS.find((migration) =>
      migration.name.includes("0017")
    );

    if (!lifecycleMigration) {
      throw new Error("Missing memory lifecycle migration.");
    }

    await applyD1Migrations(env.MIGRATION_DB, [lifecycleMigration]);
    const now = new Date().toISOString();
    const contextKey = "project:github:evepupil/CloudMind";
    await env.MIGRATION_DB.batch([
      env.MIGRATION_DB.prepare(
        `INSERT INTO assets
         (id, type, title, status, record_kind, scope_id, context_key,
          memory_root_id, memory_version, created_at, updated_at)
         VALUES ('memory-v1', 'note', 'Version 1', 'ready', 'memory', 'agent', ?,
                 'memory-v1', 1, ?, ?)`
      ).bind(contextKey, now, now),
      env.MIGRATION_DB.prepare(
        `INSERT INTO assets
         (id, type, title, status, record_kind, scope_id, context_key,
          memory_root_id, memory_version, previous_version_id, created_at, updated_at)
         VALUES ('memory-v2', 'note', 'Version 2', 'processing', 'memory', 'agent', ?,
                 'memory-v1', 2, 'memory-v1', ?, ?)`
      ).bind(contextKey, now, now),
    ]);
    const repository = new D1AssetRepository(env.MIGRATION_DB);

    await repository.completeAssetProcessing("memory-v2", {
      summary: "Version 2 summary",
      contentText: "Version 2 content",
      rawR2Key: "assets/memory-v2/raw/input.txt",
      contentR2Key: null,
    });

    const previous = await env.MIGRATION_DB.prepare(
      "SELECT superseded_by_id, superseded_at FROM assets WHERE id = 'memory-v1'"
    ).first<{
      superseded_by_id: string | null;
      superseded_at: string | null;
    }>();
    const current = await env.MIGRATION_DB.prepare(
      "SELECT status, previous_version_id, memory_version FROM assets WHERE id = 'memory-v2'"
    ).first<{
      status: string;
      previous_version_id: string | null;
      memory_version: number | null;
    }>();

    expect(previous?.superseded_by_id).toBe("memory-v2");
    expect(previous?.superseded_at).not.toBeNull();
    expect(current).toEqual({
      status: "ready",
      previous_version_id: "memory-v1",
      memory_version: 2,
    });
  });
});
