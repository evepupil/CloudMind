import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import type {
  AddProvenanceInput,
  CreateEdgeInput,
  CreateStatementInput,
  DuplicateStatementRef,
  EntityVectorRef,
  InvalidateEdgesInput,
  InvalidateStatementInput,
  ListEntitiesOptions,
  ListStatementsOptions,
  MemoryEdge,
  MemoryEntity,
  MemoryGraphCounts,
  MemoryGraphEdge,
  MemoryGraphEntity,
  MemoryKind,
  MemoryProvenanceRef,
  MemoryRepository,
  MemoryStatement,
  UpsertEntityInput,
} from "@/core/memory/ports";
import { DEFAULT_SCOPE } from "@/core/memory/scope";
import {
  LIBRARY_RECORD_KIND,
  normalizeContextKey,
  type RecordKind,
} from "@/core/records/classification";
import { createDb } from "@/platform/db/d1/client";
import {
  edges,
  entities,
  provenance,
  statements,
} from "@/platform/db/d1/schema";

// 把 statements 行投影为读模型（统一 null 语义）。
type StatementRow = typeof statements.$inferSelect;

const mapStatement = (row: StatementRow): MemoryStatement => ({
  id: row.id,
  scopeId: row.scopeId,
  contextKey: row.contextKey,
  recordKind: row.recordKind,
  subjectEntityId: row.subjectEntityId,
  predicate: row.predicate,
  objectEntityId: row.objectEntityId,
  objectLiteral: row.objectLiteral,
  nlText: row.nlText,
  confidence: row.confidence,
  importance: row.importance,
  validFrom: row.validFrom,
  validUntil: row.validUntil,
  createdAt: row.createdAt,
  expiredAt: row.expiredAt,
  supersededById: row.supersededById,
  lastAccessedAt: row.lastAccessedAt,
  accessCount: row.accessCount,
});

// 这里实现面向 D1 的 L2 记忆层写仓储；后续切库只替换这一层。
export class D1MemoryRepository implements MemoryRepository {
  private readonly db: ReturnType<typeof createDb>;

  public constructor(database: D1Database) {
    this.db = createDb(database);
  }

  public async upsertEntityByNormalizedName(
    input: UpsertEntityInput
  ): Promise<MemoryEntity> {
    const scopeId = input.scopeId ?? DEFAULT_SCOPE;
    const contextKey = normalizeContextKey(input.contextKey);
    const now = input.seenAt ?? new Date().toISOString();

    const existing = await this.db
      .select()
      .from(entities)
      .where(
        and(
          eq(entities.scopeId, scopeId),
          eq(entities.contextKey, contextKey),
          eq(entities.normalizedName, input.normalizedName)
        )
      )
      .limit(1);
    const found = existing[0];

    if (found) {
      const nextMentionCount = found.mentionCount + 1;

      await this.db
        .update(entities)
        .set({
          mentionCount: nextMentionCount,
          lastSeenAt: now,
          updatedAt: now,
          // 仅在原值缺失时补全 type / 向量 id，不覆盖已有信息。
          ...(input.type && !found.type ? { type: input.type } : {}),
          ...(input.embeddingVectorId && !found.embeddingVectorId
            ? { embeddingVectorId: input.embeddingVectorId }
            : {}),
        })
        .where(eq(entities.id, found.id));

      return {
        id: found.id,
        scopeId,
        contextKey,
        canonicalName: found.canonicalName,
        normalizedName: found.normalizedName,
        type: found.type,
        mentionCount: nextMentionCount,
      };
    }

    const id = crypto.randomUUID();

    await this.db.insert(entities).values({
      id,
      scopeId,
      contextKey,
      canonicalName: input.canonicalName,
      normalizedName: input.normalizedName,
      type: input.type ?? null,
      embeddingVectorId: input.embeddingVectorId ?? null,
      salience: 0,
      mentionCount: 1,
      aliasesJson: null,
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      scopeId,
      contextKey,
      canonicalName: input.canonicalName,
      normalizedName: input.normalizedName,
      type: input.type ?? null,
      mentionCount: 1,
    };
  }

  public async createStatement(
    input: CreateStatementInput
  ): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db.insert(statements).values({
      id,
      scopeId: input.scopeId ?? DEFAULT_SCOPE,
      contextKey: normalizeContextKey(input.contextKey),
      recordKind: input.recordKind ?? LIBRARY_RECORD_KIND,
      subjectEntityId: input.subjectEntityId,
      predicate: input.predicate,
      objectEntityId: input.objectEntityId ?? null,
      objectLiteral: input.objectLiteral ?? null,
      nlText: input.nlText,
      embeddingVectorId: input.embeddingVectorId ?? null,
      confidence: input.confidence ?? null,
      importance: input.importance ?? 0,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
      createdAt: now,
      expiredAt: null,
      supersededById: null,
      lastAccessedAt: null,
      accessCount: 0,
      updatedAt: now,
    });

    return { id };
  }

  public async createEdge(input: CreateEdgeInput): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db.insert(edges).values({
      id,
      scopeId: input.scopeId ?? DEFAULT_SCOPE,
      contextKey: normalizeContextKey(input.contextKey),
      recordKind: input.recordKind ?? LIBRARY_RECORD_KIND,
      srcEntityId: input.srcEntityId,
      dstEntityId: input.dstEntityId,
      relation: input.relation,
      weight: input.weight ?? 1,
      confidence: input.confidence ?? null,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
      createdAt: now,
      expiredAt: null,
      updatedAt: now,
    });

    return { id };
  }

  public async addProvenance(input: AddProvenanceInput): Promise<void> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db.insert(provenance).values({
      id,
      scopeId: input.scopeId ?? DEFAULT_SCOPE,
      contextKey: normalizeContextKey(input.contextKey),
      recordKind: input.recordKind ?? LIBRARY_RECORD_KIND,
      memoryType: input.memoryType,
      memoryId: input.memoryId,
      assetId: input.assetId ?? null,
      chunkIndex: input.chunkIndex ?? null,
      span: input.span ?? null,
      createdAt: now,
    });
  }

  public async getEntityByVectorId(
    vectorId: string,
    scopeId?: string,
    contextKey?: string
  ): Promise<MemoryEntity | null> {
    const scope = scopeId ?? DEFAULT_SCOPE;
    const context = normalizeContextKey(contextKey);
    const rows = await this.db
      .select()
      .from(entities)
      .where(
        and(
          eq(entities.embeddingVectorId, vectorId),
          eq(entities.scopeId, scope),
          eq(entities.contextKey, context)
        )
      )
      .limit(1);
    const found = rows[0];

    if (!found) {
      return null;
    }

    return {
      id: found.id,
      scopeId: found.scopeId,
      contextKey: found.contextKey,
      canonicalName: found.canonicalName,
      normalizedName: found.normalizedName,
      type: found.type,
      mentionCount: found.mentionCount,
    };
  }

  public async setEntityVectorId(
    entityId: string,
    vectorId: string
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(entities)
      .set({ embeddingVectorId: vectorId, updatedAt: now })
      .where(eq(entities.id, entityId));
  }

  public async findActiveStatementsBySubject(
    subjectEntityId: string,
    scopeId?: string | undefined,
    contextKey?: string | undefined,
    recordKind?: RecordKind | undefined
  ): Promise<MemoryStatement[]> {
    const scope = scopeId ?? DEFAULT_SCOPE;
    const context = normalizeContextKey(contextKey);

    const rows = await this.db
      .select()
      .from(statements)
      .where(
        and(
          eq(statements.scopeId, scope),
          eq(statements.contextKey, context),
          recordKind ? eq(statements.recordKind, recordKind) : undefined,
          eq(statements.subjectEntityId, subjectEntityId),
          // expired_at 空 = 系统仍相信该事实（双时间录入区间未关闭）。
          isNull(statements.expiredAt)
        )
      )
      .orderBy(asc(statements.createdAt));

    return rows.map(mapStatement);
  }

  public async getStatementById(
    statementId: string
  ): Promise<MemoryStatement | null> {
    const rows = await this.db
      .select()
      .from(statements)
      .where(eq(statements.id, statementId))
      .limit(1);
    const found = rows[0];

    return found ? mapStatement(found) : null;
  }

  public async invalidateStatement(
    input: InvalidateStatementInput
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(statements)
      .set({
        expiredAt: now,
        supersededById: input.supersededById ?? null,
        updatedAt: now,
      })
      .where(eq(statements.id, input.statementId));
  }

  public async invalidateActiveEdges(
    input: InvalidateEdgesInput
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .update(edges)
      .set({ expiredAt: now, updatedAt: now })
      .where(
        and(
          eq(edges.scopeId, input.scopeId ?? DEFAULT_SCOPE),
          eq(edges.contextKey, normalizeContextKey(input.contextKey)),
          input.recordKind ? eq(edges.recordKind, input.recordKind) : undefined,
          eq(edges.srcEntityId, input.srcEntityId),
          eq(edges.dstEntityId, input.dstEntityId),
          eq(edges.relation, input.relation),
          isNull(edges.expiredAt)
        )
      );
  }

  public async bumpStatementAccess(statementIds: string[]): Promise<void> {
    if (statementIds.length === 0) {
      return;
    }

    const now = new Date().toISOString();

    await this.db
      .update(statements)
      .set({
        accessCount: sql`${statements.accessCount} + 1`,
        lastAccessedAt: now,
        updatedAt: now,
      })
      .where(inArray(statements.id, statementIds));
  }

  public async findEntityIdsByVectorIds(
    vectorIds: string[],
    scopeId?: string,
    contextKey?: string
  ): Promise<EntityVectorRef[]> {
    if (vectorIds.length === 0) {
      return [];
    }

    const scope = scopeId ?? DEFAULT_SCOPE;
    const context = normalizeContextKey(contextKey);
    const rows = await this.db
      .select({
        id: entities.id,
        vectorId: entities.embeddingVectorId,
      })
      .from(entities)
      .where(
        and(
          inArray(entities.embeddingVectorId, vectorIds),
          isNotNull(entities.embeddingVectorId),
          eq(entities.scopeId, scope),
          eq(entities.contextKey, context)
        )
      );

    return rows.flatMap((row) =>
      row.vectorId ? [{ vectorId: row.vectorId, entityId: row.id }] : []
    );
  }

  public async findActiveOutgoingEdges(
    srcEntityIds: string[],
    scopeId?: string | undefined,
    contextKey?: string | undefined,
    recordKind?: RecordKind | undefined
  ): Promise<MemoryEdge[]> {
    if (srcEntityIds.length === 0) {
      return [];
    }

    const scope = scopeId ?? DEFAULT_SCOPE;
    const context = normalizeContextKey(contextKey);

    const rows = await this.db
      .select({
        id: edges.id,
        scopeId: edges.scopeId,
        contextKey: edges.contextKey,
        recordKind: edges.recordKind,
        srcEntityId: edges.srcEntityId,
        dstEntityId: edges.dstEntityId,
        relation: edges.relation,
      })
      .from(edges)
      .where(
        and(
          eq(edges.scopeId, scope),
          eq(edges.contextKey, context),
          recordKind ? eq(edges.recordKind, recordKind) : undefined,
          inArray(edges.srcEntityId, srcEntityIds),
          isNull(edges.expiredAt)
        )
      );

    return rows;
  }

  public async findActiveStatementsBySubjects(
    subjectEntityIds: string[],
    scopeId?: string | undefined,
    contextKey?: string | undefined,
    recordKind?: RecordKind | undefined
  ): Promise<MemoryStatement[]> {
    if (subjectEntityIds.length === 0) {
      return [];
    }

    const scope = scopeId ?? DEFAULT_SCOPE;
    const context = normalizeContextKey(contextKey);

    const rows = await this.db
      .select()
      .from(statements)
      .where(
        and(
          eq(statements.scopeId, scope),
          eq(statements.contextKey, context),
          recordKind ? eq(statements.recordKind, recordKind) : undefined,
          inArray(statements.subjectEntityId, subjectEntityIds),
          isNull(statements.expiredAt)
        )
      )
      .orderBy(asc(statements.createdAt));

    return rows.map(mapStatement);
  }

  public async findProvenanceByMemoryIds(
    memoryType: MemoryKind,
    memoryIds: string[]
  ): Promise<MemoryProvenanceRef[]> {
    if (memoryIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({
        memoryId: provenance.memoryId,
        assetId: provenance.assetId,
        chunkIndex: provenance.chunkIndex,
      })
      .from(provenance)
      .where(
        and(
          eq(provenance.memoryType, memoryType),
          inArray(provenance.memoryId, memoryIds)
        )
      );

    return rows;
  }

  public async findDriftedEdges(
    scopeId?: string,
    contextKey?: string,
    recordKind?: RecordKind
  ): Promise<MemoryEdge[]> {
    const scope = scopeId ?? DEFAULT_SCOPE;

    // 活跃边但无任一活跃 statement 与其端点 (scope,src=subject,relation=predicate,dst=object) 对应。
    // edge 与 statement 无 FK，靠端点相关子查询匹配（NOT EXISTS）。
    const rows = await this.db
      .select({
        id: edges.id,
        scopeId: edges.scopeId,
        contextKey: edges.contextKey,
        recordKind: edges.recordKind,
        srcEntityId: edges.srcEntityId,
        dstEntityId: edges.dstEntityId,
        relation: edges.relation,
      })
      .from(edges)
      .where(
        and(
          eq(edges.scopeId, scope),
          contextKey
            ? eq(edges.contextKey, normalizeContextKey(contextKey))
            : undefined,
          recordKind ? eq(edges.recordKind, recordKind) : undefined,
          isNull(edges.expiredAt),
          sql`not exists (select 1 from ${statements} where ${statements.scopeId} = ${edges.scopeId} and ${statements.contextKey} = ${edges.contextKey} and ${statements.recordKind} = ${edges.recordKind} and ${statements.subjectEntityId} = ${edges.srcEntityId} and ${statements.predicate} = ${edges.relation} and ${statements.objectEntityId} = ${edges.dstEntityId} and ${statements.expiredAt} is null)`
        )
      );

    return rows;
  }

  public async findDuplicateActiveStatements(
    scopeId?: string,
    contextKey?: string,
    recordKind?: RecordKind
  ): Promise<DuplicateStatementRef[]> {
    const scope = scopeId ?? DEFAULT_SCOPE;

    // 取本 scope 所有活跃陈述，在内存里按项目、记录类型和事实内容分组（数据量为个人级，安全）。
    const rows = await this.db
      .select({
        id: statements.id,
        contextKey: statements.contextKey,
        recordKind: statements.recordKind,
        subjectEntityId: statements.subjectEntityId,
        predicate: statements.predicate,
        objectEntityId: statements.objectEntityId,
        objectLiteral: statements.objectLiteral,
        createdAt: statements.createdAt,
      })
      .from(statements)
      .where(
        and(
          eq(statements.scopeId, scope),
          contextKey
            ? eq(statements.contextKey, normalizeContextKey(contextKey))
            : undefined,
          recordKind ? eq(statements.recordKind, recordKind) : undefined,
          isNull(statements.expiredAt)
        )
      );

    return groupDuplicateStatements(rows);
  }

  public async listEntities(
    options?: ListEntitiesOptions
  ): Promise<MemoryGraphEntity[]> {
    const scope = options?.scopeId ?? DEFAULT_SCOPE;
    const context = normalizeContextKey(options?.contextKey);

    const rows = await this.db
      .select({
        id: entities.id,
        scopeId: entities.scopeId,
        contextKey: entities.contextKey,
        canonicalName: entities.canonicalName,
        type: entities.type,
        salience: entities.salience,
        mentionCount: entities.mentionCount,
        firstSeenAt: entities.firstSeenAt,
        lastSeenAt: entities.lastSeenAt,
      })
      .from(entities)
      .where(and(eq(entities.scopeId, scope), eq(entities.contextKey, context)))
      // 按显著性降序、提及数次之——最重要的实体排在前。
      .orderBy(desc(entities.salience), desc(entities.mentionCount))
      .limit(options?.limit ?? 200)
      .offset(options?.offset ?? 0);

    return rows;
  }

  public async getEntityById(
    entityId: string
  ): Promise<MemoryGraphEntity | null> {
    const rows = await this.db
      .select({
        id: entities.id,
        scopeId: entities.scopeId,
        contextKey: entities.contextKey,
        canonicalName: entities.canonicalName,
        type: entities.type,
        salience: entities.salience,
        mentionCount: entities.mentionCount,
        firstSeenAt: entities.firstSeenAt,
        lastSeenAt: entities.lastSeenAt,
      })
      .from(entities)
      .where(eq(entities.id, entityId))
      .limit(1);

    return rows[0] ?? null;
  }

  public async listActiveEdges(
    scopeId?: string | undefined,
    contextKey?: string | undefined,
    recordKind?: RecordKind | undefined
  ): Promise<MemoryGraphEdge[]> {
    const scope = scopeId ?? DEFAULT_SCOPE;
    const context = normalizeContextKey(contextKey);

    const rows = await this.db
      .select({
        id: edges.id,
        scopeId: edges.scopeId,
        contextKey: edges.contextKey,
        recordKind: edges.recordKind,
        srcEntityId: edges.srcEntityId,
        dstEntityId: edges.dstEntityId,
        relation: edges.relation,
      })
      .from(edges)
      .where(
        and(
          eq(edges.scopeId, scope),
          eq(edges.contextKey, context),
          recordKind ? eq(edges.recordKind, recordKind) : undefined,
          isNull(edges.expiredAt)
        )
      );

    return rows;
  }

  public async listStatements(
    options?: ListStatementsOptions
  ): Promise<MemoryStatement[]> {
    const scope = options?.scopeId ?? DEFAULT_SCOPE;
    const context = normalizeContextKey(options?.contextKey);
    const conditions = [
      eq(statements.scopeId, scope),
      eq(statements.contextKey, context),
    ];

    if (options?.recordKind) {
      conditions.push(eq(statements.recordKind, options.recordKind));
    }

    if (options?.subjectEntityId) {
      conditions.push(eq(statements.subjectEntityId, options.subjectEntityId));
    }
    if (!options?.includeExpired) {
      conditions.push(isNull(statements.expiredAt));
    }

    const rows = await this.db
      .select()
      .from(statements)
      .where(and(...conditions))
      // 时间线按创建时间降序（最新在前）。
      .orderBy(desc(statements.createdAt))
      .limit(options?.limit ?? 100)
      .offset(options?.offset ?? 0);

    return rows.map(mapStatement);
  }

  public async countGraph(
    scopeId?: string | undefined,
    contextKey?: string | undefined,
    recordKind?: RecordKind | undefined
  ): Promise<MemoryGraphCounts> {
    const scope = scopeId ?? DEFAULT_SCOPE;
    const context = normalizeContextKey(contextKey);

    // 三表活跃计数并行（statements/edges 仅计未失效）。
    const [entityRows, statementRows, edgeRows] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(entities)
        .where(
          and(eq(entities.scopeId, scope), eq(entities.contextKey, context))
        ),
      this.db
        .select({ value: count() })
        .from(statements)
        .where(
          and(
            eq(statements.scopeId, scope),
            eq(statements.contextKey, context),
            recordKind ? eq(statements.recordKind, recordKind) : undefined,
            isNull(statements.expiredAt)
          )
        ),
      this.db
        .select({ value: count() })
        .from(edges)
        .where(
          and(
            eq(edges.scopeId, scope),
            eq(edges.contextKey, context),
            recordKind ? eq(edges.recordKind, recordKind) : undefined,
            isNull(edges.expiredAt)
          )
        ),
    ]);

    return {
      entities: entityRows[0]?.value ?? 0,
      statements: statementRows[0]?.value ?? 0,
      edges: edgeRows[0]?.value ?? 0,
    };
  }
}

// 把活跃陈述按 (subject,predicate,object_entity|object_literal) 归组，
// 每组保留 created_at 最早者为 retain，其余作为 duplicate 返回。
const groupDuplicateStatements = (
  rows: Array<{
    id: string;
    contextKey: string;
    recordKind: RecordKind;
    subjectEntityId: string;
    predicate: string;
    objectEntityId: string | null;
    objectLiteral: string | null;
    createdAt: string;
  }>
): DuplicateStatementRef[] => {
  const groups = new Map<string, typeof rows>();

  for (const row of rows) {
    const key = JSON.stringify([
      row.contextKey,
      row.subjectEntityId,
      row.recordKind,
      row.predicate,
      row.objectEntityId ?? "",
      row.objectLiteral ?? "",
    ]);
    const group = groups.get(key);

    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const duplicates: DuplicateStatementRef[] = [];

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }

    const sorted = [...group].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
    const retain = sorted[0];

    if (!retain) {
      continue;
    }

    for (const row of sorted.slice(1)) {
      duplicates.push({ duplicateId: row.id, retainId: retain.id });
    }
  }

  return duplicates;
};
