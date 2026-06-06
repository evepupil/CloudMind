import type { MemoryRepository } from "@/core/memory/ports";

import { type ExtractedGraph, normalizeEntityName } from "./graph-extraction";

export interface MemoryWriteTarget {
  scopeId?: string | undefined;
  assetId: string;
  episodeId?: string | null | undefined;
  chunkIndex?: number | null | undefined;
}

export interface MemoryWriteResult {
  entityCount: number;
  statementCount: number;
  edgeCount: number;
}

// 把抽取出的知识图谱写入 L2：先按归一化名幂等消歧出实体 id，再写 statements，
// 宾语为实体时额外写一条 edge（图关系），每条记忆都补 provenance 指回 L1。
export const writeGraphToMemory = async (
  memoryRepository: MemoryRepository,
  target: MemoryWriteTarget,
  graph: ExtractedGraph
): Promise<MemoryWriteResult> => {
  const scopeId = target.scopeId;
  const entityIdByNormalized = new Map<string, string>();
  // 优先采用 entities 列表里声明的 type；statement 里出现的实体若未声明则 type 为空。
  const typeByNormalized = new Map<string, string | null>();

  for (const entity of graph.entities) {
    const normalized = normalizeEntityName(entity.name);

    if (normalized && !typeByNormalized.has(normalized)) {
      typeByNormalized.set(normalized, entity.type);
    }
  }

  const resolveEntity = async (rawName: string): Promise<string | null> => {
    const normalized = normalizeEntityName(rawName);

    if (!normalized) {
      return null;
    }

    const cached = entityIdByNormalized.get(normalized);

    if (cached) {
      return cached;
    }

    const entity = await memoryRepository.upsertEntityByNormalizedName({
      scopeId,
      canonicalName: rawName.trim(),
      normalizedName: normalized,
      type: typeByNormalized.get(normalized) ?? null,
    });

    entityIdByNormalized.set(normalized, entity.id);

    return entity.id;
  };

  // 先把声明过的实体都消歧落库，保证 mention_count 与 type 完整。
  for (const entity of graph.entities) {
    await resolveEntity(entity.name);
  }

  let statementCount = 0;
  let edgeCount = 0;

  for (const statement of graph.statements) {
    const subjectId = await resolveEntity(statement.subject);

    if (!subjectId) {
      continue;
    }

    const objectEntityId = statement.objectIsEntity
      ? await resolveEntity(statement.object)
      : null;

    const created = await memoryRepository.createStatement({
      scopeId,
      subjectEntityId: subjectId,
      predicate: statement.predicate,
      objectEntityId,
      objectLiteral: objectEntityId ? null : statement.object,
      nlText: statement.nlText,
      confidence: statement.confidence,
      importance: 0,
    });
    statementCount += 1;

    await memoryRepository.addProvenance({
      scopeId,
      memoryType: "statement",
      memoryId: created.id,
      episodeId: target.episodeId ?? null,
      assetId: target.assetId,
      chunkIndex: target.chunkIndex ?? null,
    });

    // 宾语是实体 → 同时落一条有向边，作为递归 CTE 多跳遍历的图结构。
    if (objectEntityId) {
      const edge = await memoryRepository.createEdge({
        scopeId,
        srcEntityId: subjectId,
        dstEntityId: objectEntityId,
        relation: statement.predicate,
        confidence: statement.confidence,
      });
      edgeCount += 1;

      await memoryRepository.addProvenance({
        scopeId,
        memoryType: "edge",
        memoryId: edge.id,
        episodeId: target.episodeId ?? null,
        assetId: target.assetId,
        chunkIndex: target.chunkIndex ?? null,
      });
    }
  }

  return {
    entityCount: entityIdByNormalized.size,
    statementCount,
    edgeCount,
  };
};
