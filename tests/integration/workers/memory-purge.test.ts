import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { D1MemoryPurgeRepository } from "@/platform/db/d1/repositories/d1-memory-purge-repository";

const now = "2026-07-24T08:00:00.000Z";
const beforeRestore = "2026-07-24T07:00:00.000Z";
const contextKey = "project:github:evepupil/CloudMind-purge-gate";

const countRows = async (table: string, id: string): Promise<number> => {
  const result = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM "${table}" WHERE id = ?`
  )
    .bind(id)
    .first<{ count: number }>();

  return result?.count ?? 0;
};

describe("memory hard delete repository", () => {
  it("rolls back graph records created for a failed restore while retaining shared entities", async () => {
    const ids = {
      asset: crypto.randomUUID(),
      otherAsset: crypto.randomUUID(),
      exclusiveEntity: crypto.randomUUID(),
      sharedEntity: crypto.randomUUID(),
      statement: crypto.randomUUID(),
      edge: crypto.randomUUID(),
    };
    const insertAsset = env.DB.prepare(
      `INSERT INTO assets (
         id, type, title, status, record_kind, scope_id, context_key,
         deleted_at, created_at, updated_at
       ) VALUES (?, 'note', 'restore rollback fixture', 'ready', 'memory',
                 'agent', ?, ?, ?, ?)`
    );
    await env.DB.batch([
      insertAsset.bind(ids.asset, contextKey, now, now, now),
      insertAsset.bind(ids.otherAsset, contextKey, now, now, now),
    ]);

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO entities (
           id, scope_id, context_key, canonical_name, normalized_name,
           embedding_vector_id, created_at, updated_at
         ) VALUES (?, 'agent', ?, ?, ?, ?, ?, ?)`
      ).bind(
        ids.exclusiveEntity,
        contextKey,
        "exclusive",
        "exclusive",
        `graph-${ids.exclusiveEntity}`,
        now,
        now
      ),
      env.DB.prepare(
        `INSERT INTO entities (
           id, scope_id, context_key, canonical_name, normalized_name,
           embedding_vector_id, created_at, updated_at
         ) VALUES (?, 'agent', ?, ?, ?, ?, ?, ?)`
      ).bind(
        ids.sharedEntity,
        contextKey,
        "shared",
        "shared",
        `graph-${ids.sharedEntity}`,
        beforeRestore,
        beforeRestore
      ),
      env.DB.prepare(
        `INSERT INTO statements (
           id, scope_id, context_key, record_kind, subject_entity_id,
           predicate, object_literal, nl_text, created_at, updated_at
         ) VALUES (?, 'agent', ?, 'memory', ?, 'is', 'value', 'fixture', ?, ?)`
      ).bind(ids.statement, contextKey, ids.exclusiveEntity, now, now),
      env.DB.prepare(
        `INSERT INTO edges (
           id, scope_id, context_key, record_kind, src_entity_id,
           dst_entity_id, relation, created_at, updated_at
         ) VALUES (?, 'agent', ?, 'memory', ?, ?, 'links', ?, ?)`
      ).bind(
        ids.edge,
        contextKey,
        ids.exclusiveEntity,
        ids.sharedEntity,
        now,
        now
      ),
    ]);

    const insertProvenance = env.DB.prepare(
      `INSERT INTO provenance (
         id, scope_id, context_key, record_kind, memory_type,
         memory_id, asset_id, created_at
       ) VALUES (?, 'agent', ?, 'memory', ?, ?, ?, ?)`
    );
    await env.DB.batch([
      insertProvenance.bind(
        crypto.randomUUID(),
        contextKey,
        "statement",
        ids.statement,
        ids.asset,
        now
      ),
      insertProvenance.bind(
        crypto.randomUUID(),
        contextKey,
        "edge",
        ids.edge,
        ids.asset,
        now
      ),
    ]);

    const repository = new D1MemoryPurgeRepository(env.DB);
    const plan = await repository.prepareMemoryRestoreRollback({
      id: ids.asset,
      scopeId: "agent",
      contextKey,
      createdAfter: now,
    });

    expect(plan.graphVectorIds).toEqual([`graph-${ids.exclusiveEntity}`]);
    expect(plan.statementIds).toEqual([ids.statement]);
    expect(plan.edgeIds).toEqual([ids.edge]);
    expect(plan.entityIds).toEqual([ids.exclusiveEntity]);

    await repository.completeMemoryRestoreRollback(plan);

    expect(await countRows("statements", ids.statement)).toBe(0);
    expect(await countRows("edges", ids.edge)).toBe(0);
    expect(await countRows("entities", ids.exclusiveEntity)).toBe(0);
    expect(await countRows("entities", ids.sharedEntity)).toBe(1);
  });

  it("deletes one version chain while retaining shared L2 records", async () => {
    const ids = {
      v1: crypto.randomUUID(),
      v2: crypto.randomUUID(),
      other: crypto.randomUUID(),
      exclusiveEntityA: crypto.randomUUID(),
      exclusiveEntityB: crypto.randomUUID(),
      sharedEntity: crypto.randomUUID(),
      exclusiveStatement: crypto.randomUUID(),
      sharedStatement: crypto.randomUUID(),
      exclusiveEdge: crypto.randomUUID(),
    };
    const insertAsset = env.DB.prepare(
      `INSERT INTO assets (
         id, type, title, status, record_kind, scope_id, context_key,
         memory_root_id, memory_version, previous_version_id,
         superseded_by_id, superseded_at, raw_r2_key, content_r2_key,
         deleted_at, created_at, updated_at
       ) VALUES (?, 'note', 'purge fixture', 'ready', 'memory', 'agent', ?,
                 ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    await env.DB.batch([
      insertAsset.bind(
        ids.v1,
        contextKey,
        ids.v1,
        1,
        null,
        ids.v2,
        now,
        `assets/${ids.v1}/raw/input.txt`,
        `assets/${ids.v1}/content/content.txt`,
        null,
        now,
        now
      ),
      insertAsset.bind(
        ids.v2,
        contextKey,
        ids.v1,
        2,
        ids.v1,
        null,
        null,
        `assets/${ids.v2}/raw/input.txt`,
        null,
        now,
        now,
        now
      ),
      insertAsset.bind(
        ids.other,
        contextKey,
        ids.other,
        1,
        null,
        null,
        null,
        `assets/${ids.other}/raw/input.txt`,
        null,
        null,
        now,
        now
      ),
    ]);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO asset_chunks (
           id, asset_id, record_kind, scope_id, context_key, chunk_index,
           text_preview, content_text, vector_id, created_at, updated_at
         ) VALUES (?, ?, 'memory', 'agent', ?, 0, 'preview', 'content', ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        ids.v2,
        contextKey,
        `chunk-${ids.v2}`,
        now,
        now
      ),
      env.DB.prepare(
        `INSERT INTO asset_artifacts (
           id, asset_id, artifact_type, version, storage_kind, r2_key, created_at
         ) VALUES (?, ?, 'summary', 1, 'r2', ?, ?)`
      ).bind(
        crypto.randomUUID(),
        ids.v1,
        `assets/${ids.v1}/artifacts/summary.txt`,
        now
      ),
    ]);
    const insertEntity = env.DB.prepare(
      `INSERT INTO entities (
         id, scope_id, context_key, canonical_name, normalized_name,
         embedding_vector_id, created_at, updated_at
       ) VALUES (?, 'agent', ?, ?, ?, ?, ?, ?)`
    );
    await env.DB.batch([
      insertEntity.bind(
        ids.exclusiveEntityA,
        contextKey,
        "exclusive-a",
        "exclusive-a",
        `graph-${ids.exclusiveEntityA}`,
        now,
        now
      ),
      insertEntity.bind(
        ids.exclusiveEntityB,
        contextKey,
        "exclusive-b",
        "exclusive-b",
        `graph-${ids.exclusiveEntityB}`,
        now,
        now
      ),
      insertEntity.bind(
        ids.sharedEntity,
        contextKey,
        "shared",
        "shared",
        `graph-${ids.sharedEntity}`,
        now,
        now
      ),
    ]);
    const insertStatement = env.DB.prepare(
      `INSERT INTO statements (
         id, scope_id, context_key, record_kind, subject_entity_id,
         predicate, object_literal, nl_text, created_at, updated_at
       ) VALUES (?, 'agent', ?, 'memory', ?, 'is', 'value', 'fixture', ?, ?)`
    );
    await env.DB.batch([
      insertStatement.bind(
        ids.exclusiveStatement,
        contextKey,
        ids.exclusiveEntityA,
        now,
        now
      ),
      insertStatement.bind(
        ids.sharedStatement,
        contextKey,
        ids.sharedEntity,
        now,
        now
      ),
      env.DB.prepare(
        `INSERT INTO edges (
           id, scope_id, context_key, record_kind, src_entity_id,
           dst_entity_id, relation, created_at, updated_at
         ) VALUES (?, 'agent', ?, 'memory', ?, ?, 'links', ?, ?)`
      ).bind(
        ids.exclusiveEdge,
        contextKey,
        ids.exclusiveEntityA,
        ids.exclusiveEntityB,
        now,
        now
      ),
    ]);
    const insertProvenance = env.DB.prepare(
      `INSERT INTO provenance (
         id, scope_id, context_key, record_kind, memory_type,
         memory_id, asset_id, created_at
       ) VALUES (?, 'agent', ?, 'memory', ?, ?, ?, ?)`
    );
    await env.DB.batch([
      insertProvenance.bind(
        crypto.randomUUID(),
        contextKey,
        "statement",
        ids.exclusiveStatement,
        ids.v1,
        now
      ),
      insertProvenance.bind(
        crypto.randomUUID(),
        contextKey,
        "edge",
        ids.exclusiveEdge,
        ids.v1,
        now
      ),
      insertProvenance.bind(
        crypto.randomUUID(),
        contextKey,
        "entity",
        ids.exclusiveEntityA,
        ids.v1,
        now
      ),
      insertProvenance.bind(
        crypto.randomUUID(),
        contextKey,
        "entity",
        ids.exclusiveEntityB,
        ids.v1,
        now
      ),
      insertProvenance.bind(
        crypto.randomUUID(),
        contextKey,
        "statement",
        ids.sharedStatement,
        ids.v1,
        now
      ),
      insertProvenance.bind(
        crypto.randomUUID(),
        contextKey,
        "statement",
        ids.sharedStatement,
        ids.other,
        now
      ),
      insertProvenance.bind(
        crypto.randomUUID(),
        contextKey,
        "entity",
        ids.sharedEntity,
        ids.v1,
        now
      ),
      insertProvenance.bind(
        crypto.randomUUID(),
        contextKey,
        "entity",
        ids.sharedEntity,
        ids.other,
        now
      ),
    ]);

    const repository = new D1MemoryPurgeRepository(env.DB);
    const plan = await repository.prepareMemoryPurge({
      id: ids.v2,
      scopeId: "agent",
      contextKey,
    });

    expect(new Set(plan.assetIds)).toEqual(new Set([ids.v1, ids.v2]));
    expect(plan.assetVectorIds).toEqual([`chunk-${ids.v2}`]);
    expect(plan.statementIds).toEqual([ids.exclusiveStatement]);
    expect(plan.edgeIds).toEqual([ids.exclusiveEdge]);
    expect(new Set(plan.entityIds)).toEqual(
      new Set([ids.exclusiveEntityA, ids.exclusiveEntityB])
    );
    expect(await countRows("assets", ids.v2)).toBe(1);

    await repository.completeMemoryPurge(plan);

    expect(await countRows("assets", ids.v1)).toBe(0);
    expect(await countRows("assets", ids.v2)).toBe(0);
    expect(await countRows("assets", ids.other)).toBe(1);
    expect(await countRows("statements", ids.exclusiveStatement)).toBe(0);
    expect(await countRows("statements", ids.sharedStatement)).toBe(1);
    expect(await countRows("entities", ids.exclusiveEntityA)).toBe(0);
    expect(await countRows("entities", ids.sharedEntity)).toBe(1);
    const audit = await env.DB.prepare(
      `SELECT status, target_hash AS targetHash, completed_at AS completedAt
       FROM deletion_audits WHERE id = ?`
    )
      .bind(plan.auditId)
      .first<{
        status: string;
        targetHash: string;
        completedAt: string | null;
      }>();
    expect(audit).toMatchObject({ status: "completed" });
    expect(audit?.targetHash).toHaveLength(64);
    expect(audit?.targetHash).not.toContain(ids.v2);
    expect(audit?.completedAt).toBeTruthy();
  });
});
