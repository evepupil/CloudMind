import { z } from "zod";

import type {
  MemoryPurgeFailureCode,
  MemoryPurgePlan,
  MemoryPurgeRepository,
  MemoryPurgeTarget,
} from "@/core/sovereignty/ports";

const targetSchema = z.object({
  id: z.string(),
  memoryRootId: z.string().nullable(),
  recordKind: z.string(),
  scopeId: z.string(),
  contextKey: z.string(),
  deletedAt: z.string().nullable(),
  supersededAt: z.string().nullable(),
});
const assetPlanRowSchema = z.object({
  id: z.string(),
  rawR2Key: z.string().nullable(),
  contentR2Key: z.string().nullable(),
});
const optionalIdSchema = z.object({ id: z.string().nullable() });
const entityPlanRowSchema = z.object({
  id: z.string(),
  vectorId: z.string().nullable(),
});

const uniqueStrings = (values: Array<string | null>): string[] => [
  ...new Set(values.filter((value): value is string => Boolean(value))),
];

const placeholders = (count: number): string =>
  Array.from({ length: count }, () => "?").join(", ");

const sha256 = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export class D1MemoryPurgeRepository implements MemoryPurgeRepository {
  public constructor(private readonly database: D1Database) {}

  private async queryRows<T>(
    schema: z.ZodType<T>,
    sql: string,
    bindings: unknown[] = []
  ): Promise<T[]> {
    const result = await this.database
      .prepare(sql)
      .bind(...bindings)
      .all<unknown>();

    return result.results.map((row) => schema.parse(row));
  }

  private async findExclusiveMemoryIds(
    memoryType: "statement" | "entity" | "edge",
    assetIds: string[]
  ): Promise<string[]> {
    const assetPlaceholders = placeholders(assetIds.length);
    const rows = await this.queryRows(
      optionalIdSchema,
      `SELECT DISTINCT source.memory_id AS id
       FROM provenance source
       WHERE source.memory_type = ?
         AND source.asset_id IN (${assetPlaceholders})
         AND NOT EXISTS (
           SELECT 1
           FROM provenance retained
           WHERE retained.memory_type = source.memory_type
             AND retained.memory_id = source.memory_id
             AND (
               retained.asset_id IS NULL
               OR retained.asset_id NOT IN (${assetPlaceholders})
             )
         )`,
      [memoryType, ...assetIds, ...assetIds]
    );

    return uniqueStrings(rows.map((row) => row.id));
  }

  private async findDeletableEntities(
    candidateIds: string[],
    statementIds: string[],
    edgeIds: string[]
  ): Promise<Array<{ id: string; vectorId: string | null }>> {
    if (candidateIds.length === 0) {
      return [];
    }

    const statementRetention =
      statementIds.length > 0
        ? `AND statement.id NOT IN (${placeholders(statementIds.length)})`
        : "";
    const edgeRetention =
      edgeIds.length > 0
        ? `AND edge.id NOT IN (${placeholders(edgeIds.length)})`
        : "";

    return this.queryRows(
      entityPlanRowSchema,
      `SELECT entity.id AS id, entity.embedding_vector_id AS vectorId
       FROM entities entity
       WHERE entity.id IN (${placeholders(candidateIds.length)})
         AND NOT EXISTS (
           SELECT 1 FROM statements statement
           WHERE (
             statement.subject_entity_id = entity.id
             OR statement.object_entity_id = entity.id
           )
           ${statementRetention}
         )
         AND NOT EXISTS (
           SELECT 1 FROM edges edge
           WHERE (
             edge.src_entity_id = entity.id
             OR edge.dst_entity_id = entity.id
           )
           ${edgeRetention}
         )`,
      [...candidateIds, ...statementIds, ...edgeIds]
    );
  }

  public async prepareMemoryPurge(
    target: MemoryPurgeTarget
  ): Promise<MemoryPurgePlan> {
    const [record] = await this.queryRows(
      targetSchema,
      `SELECT id, memory_root_id AS memoryRootId, record_kind AS recordKind,
              scope_id AS scopeId, context_key AS contextKey,
              deleted_at AS deletedAt, superseded_at AS supersededAt
       FROM assets WHERE id = ? LIMIT 1`,
      [target.id]
    );

    if (
      record?.recordKind !== "memory" ||
      record.scopeId !== target.scopeId ||
      record.contextKey !== target.contextKey ||
      record.supersededAt !== null ||
      record.deletedAt === null
    ) {
      throw new Error("Memory purge target changed before cleanup started.");
    }

    const rootId = record.memoryRootId ?? record.id;
    const assets = await this.queryRows(
      assetPlanRowSchema,
      `SELECT id, raw_r2_key AS rawR2Key, content_r2_key AS contentR2Key
       FROM assets
       WHERE record_kind = 'memory' AND scope_id = ? AND context_key = ?
         AND (memory_root_id = ? OR id = ?)
       ORDER BY memory_version, created_at`,
      [target.scopeId, target.contextKey, rootId, rootId]
    );
    const assetIds = assets.map((asset) => asset.id);

    if (!assetIds.includes(target.id)) {
      throw new Error("Memory purge version chain is incomplete.");
    }

    const assetClause = placeholders(assetIds.length);
    const [artifactKeys, assetVectorRows] = await Promise.all([
      this.queryRows(
        optionalIdSchema,
        `SELECT r2_key AS id FROM asset_artifacts
         WHERE asset_id IN (${assetClause}) AND r2_key IS NOT NULL`,
        assetIds
      ),
      this.queryRows(
        optionalIdSchema,
        `SELECT vector_id AS id FROM asset_chunks
         WHERE asset_id IN (${assetClause}) AND vector_id IS NOT NULL`,
        assetIds
      ),
    ]);
    const [statementIds, edgeIds, entityCandidateIds] = await Promise.all([
      this.findExclusiveMemoryIds("statement", assetIds),
      this.findExclusiveMemoryIds("edge", assetIds),
      this.findExclusiveMemoryIds("entity", assetIds),
    ]);
    const deletableEntities = await this.findDeletableEntities(
      entityCandidateIds,
      statementIds,
      edgeIds
    );
    const blobKeys = uniqueStrings([
      ...assets.flatMap((asset) => [asset.rawR2Key, asset.contentR2Key]),
      ...artifactKeys.map((row) => row.id),
    ]);
    const assetVectorIds = uniqueStrings(assetVectorRows.map((row) => row.id));
    const graphVectorIds = uniqueStrings(
      deletableEntities.map((entity) => entity.vectorId)
    );
    const entityIds = deletableEntities.map((entity) => entity.id);
    const auditId = crypto.randomUUID();
    const now = new Date().toISOString();
    const auditResult = await this.database.batch([
      this.database
        .prepare(
          `INSERT INTO deletion_audits (
             id, target_hash, target_kind, status, asset_count, blob_count,
             asset_vector_count, graph_vector_count, l2_record_count,
             created_at, updated_at
           ) VALUES (?, ?, 'memory', 'pending', ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          auditId,
          await sha256(target.id),
          assetIds.length,
          blobKeys.length,
          assetVectorIds.length,
          graphVectorIds.length,
          statementIds.length + edgeIds.length + entityIds.length,
          now,
          now
        ),
      this.database
        .prepare(
          `UPDATE assets SET purge_pending_at = ?, updated_at = ?
           WHERE id IN (${assetClause})`
        )
        .bind(now, now, ...assetIds),
    ]);

    if (
      (auditResult[0]?.meta.changes ?? 0) !== 1 ||
      (auditResult[1]?.meta.changes ?? 0) !== assetIds.length
    ) {
      throw new Error("Memory purge could not reserve the version chain.");
    }

    return {
      auditId,
      assetIds,
      blobKeys,
      assetVectorIds,
      graphVectorIds,
      statementIds,
      edgeIds,
      entityIds,
    };
  }

  public async completeMemoryPurge(plan: MemoryPurgePlan): Promise<void> {
    const statements: D1PreparedStatement[] = [];
    const appendDelete = (table: string, ids: string[]): void => {
      if (ids.length === 0) {
        return;
      }

      statements.push(
        this.database
          .prepare(
            `DELETE FROM "${table}" WHERE id IN (${placeholders(ids.length)})`
          )
          .bind(...ids)
      );
    };

    appendDelete("edges", plan.edgeIds);
    appendDelete("statements", plan.statementIds);
    appendDelete("entities", plan.entityIds);
    appendDelete("assets", plan.assetIds);
    const now = new Date().toISOString();
    statements.push(
      this.database
        .prepare(
          `UPDATE deletion_audits
           SET status = 'completed', error_code = NULL, updated_at = ?, completed_at = ?
           WHERE id = ? AND status IN ('pending', 'failed')`
        )
        .bind(now, now, plan.auditId)
    );
    const results = await this.database.batch(statements);

    if ((results.at(-1)?.meta.changes ?? 0) !== 1) {
      throw new Error("Memory purge audit could not be completed.");
    }
  }

  public async failMemoryPurge(
    auditId: string,
    errorCode: MemoryPurgeFailureCode
  ): Promise<void> {
    await this.database
      .prepare(
        `UPDATE deletion_audits
         SET status = 'failed', error_code = ?, updated_at = ?
         WHERE id = ? AND status = 'pending'`
      )
      .bind(errorCode, new Date().toISOString(), auditId)
      .run();
  }
}
