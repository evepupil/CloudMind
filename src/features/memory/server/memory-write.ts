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

// 可选的 embedding 消歧能力：给名字嵌入向量，在 Vectorize 里找最近邻。
// 注入方式由调用方决定（step 里提供 AI + VectorStore，测试里提供 fake）。
export interface EmbedDeduplicate {
  embedAndUpsert(
    entityId: string,
    name: string
  ): Promise<{ vectorId: string; mergedEntityId: string | null }>;
}

// 把抽取出的知识图谱写入 L2：先按归一化名幂等消歧出实体 id，再写 statements，
// 宾语为实体时额外写一条 edge（图关系），每条记忆都补 provenance 指回 L1。
// embedDeduplicate 可选：提供时用 embedding ANN 做模糊消歧（≥0.86 合并），否则仅精确归一化名。
export const writeGraphToMemory = async (
  memoryRepository: MemoryRepository,
  target: MemoryWriteTarget,
  graph: ExtractedGraph,
  embedDeduplicate?: EmbedDeduplicate
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

    // 1. 进程内缓存（同一次 write 内的重复实体直接复用）
    const cached = entityIdByNormalized.get(normalized);

    if (cached) {
      return cached;
    }

    // 2. 仓储级精确归一化名匹配
    const entity = await memoryRepository.upsertEntityByNormalizedName({
      scopeId,
      canonicalName: rawName.trim(),
      normalizedName: normalized,
      type: typeByNormalized.get(normalized) ?? null,
    });
    entityIdByNormalized.set(normalized, entity.id);

    // 3. 可选：embedding ANN 模糊消歧（处理同实体不同名/别名/错字）
    if (embedDeduplicate) {
      const result = await embedDeduplicate.embedAndUpsert(
        entity.id,
        entity.canonicalName
      );

      if (result.mergedEntityId && result.mergedEntityId !== entity.id) {
        // 找到了更高相似度的已存在实体 → 合并（用已存在的 id 替代）
        entityIdByNormalized.set(normalized, result.mergedEntityId);

        return result.mergedEntityId;
      }
    }

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
