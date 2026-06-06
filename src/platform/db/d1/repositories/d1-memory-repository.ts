import { and, eq } from "drizzle-orm";
import type {
  AddProvenanceInput,
  CreateEdgeInput,
  CreateEpisodeInput,
  CreateStatementInput,
  MemoryEntity,
  MemoryRepository,
  UpsertEntityInput,
} from "@/core/memory/ports";
import { createDb } from "@/platform/db/d1/client";
import {
  edges,
  entities,
  episodes,
  provenance,
  statements,
} from "@/platform/db/d1/schema";

const DEFAULT_SCOPE = "default";

// 这里实现面向 D1 的 L2 记忆层写仓储；后续切库只替换这一层。
export class D1MemoryRepository implements MemoryRepository {
  private readonly db: ReturnType<typeof createDb>;

  public constructor(database: D1Database) {
    this.db = createDb(database);
  }

  public async createEpisode(
    input: CreateEpisodeInput
  ): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db.insert(episodes).values({
      id,
      scopeId: input.scopeId ?? DEFAULT_SCOPE,
      kind: input.kind,
      assetId: input.assetId ?? null,
      rawText: input.rawText ?? null,
      rawR2Key: input.rawR2Key ?? null,
      actor: input.actor ?? null,
      occurredAt: input.occurredAt ?? null,
      recordedAt: input.recordedAt ?? now,
      createdAt: now,
    });

    return { id };
  }

  public async upsertEntityByNormalizedName(
    input: UpsertEntityInput
  ): Promise<MemoryEntity> {
    const scopeId = input.scopeId ?? DEFAULT_SCOPE;
    const now = input.seenAt ?? new Date().toISOString();

    const existing = await this.db
      .select()
      .from(entities)
      .where(
        and(
          eq(entities.scopeId, scopeId),
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
      memoryType: input.memoryType,
      memoryId: input.memoryId,
      episodeId: input.episodeId ?? null,
      assetId: input.assetId ?? null,
      chunkIndex: input.chunkIndex ?? null,
      span: input.span ?? null,
      createdAt: now,
    });
  }

  public async getEntityByVectorId(
    vectorId: string
  ): Promise<MemoryEntity | null> {
    const rows = await this.db
      .select()
      .from(entities)
      .where(eq(entities.embeddingVectorId, vectorId))
      .limit(1);
    const found = rows[0];

    if (!found) {
      return null;
    }

    return {
      id: found.id,
      scopeId: found.scopeId,
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
}
