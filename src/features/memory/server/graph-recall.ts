import type { MemoryRepository, MemoryStatement } from "@/core/memory/ports";
import type { VectorStore } from "@/core/vector/ports";

// 图检索只需要 MemoryRepository 的读侧子集，收窄依赖便于测试注入。
export type GraphRecallRepository = Pick<
  MemoryRepository,
  | "findEntityIdsByVectorIds"
  | "findActiveOutgoingEdges"
  | "findActiveStatementsBySubjects"
  | "findProvenanceByMemoryIds"
>;

export interface GraphRecallOptions {
  // ANN 种子实体召回数。
  seedTopK?: number | undefined;
  // 沿 edges 向外遍历的最大跳数（控延迟，默认 2）。
  maxHops?: number | undefined;
  // 每跳分数衰减系数（关联越远越弱）。
  hopDecay?: number | undefined;
  // 最终返回的图证据陈述上限。
  maxStatements?: number | undefined;
}

export interface GraphRecallInput {
  queryVector: number[];
  repository: GraphRecallRepository;
  graphVectorStore: VectorStore;
  scopeId?: string | undefined;
  options?: GraphRecallOptions | undefined;
}

// 一条图证据：命中的陈述 + 钻取到的 L1 资产 + 关联强度分与跳距。
export interface GraphRecallHit {
  statement: MemoryStatement;
  assetId: string | null;
  score: number;
  hops: number;
}

interface Reach {
  score: number;
  hops: number;
}

// 图检索：query 向量 → ANN 种子实体 → 沿未失效出边 BFS 1-2 跳 → 收集主语命中的活跃陈述
// → 按种子相似度×跳距衰减打分 → 钻取 provenance 得 L1 资产。纯逻辑、可注入、可单测。
export const recallGraphStatements = async (
  input: GraphRecallInput
): Promise<GraphRecallHit[]> => {
  const { queryVector, repository, graphVectorStore, scopeId } = input;
  const seedTopK = input.options?.seedTopK ?? 8;
  const maxHops = input.options?.maxHops ?? 2;
  const hopDecay = input.options?.hopDecay ?? 0.6;
  const maxStatements = input.options?.maxStatements ?? 20;

  if (queryVector.length === 0) {
    return [];
  }

  // 1. ANN 种子：query 向量在 graph_entities namespace 找最相似实体向量。
  const seedMatches = await graphVectorStore.search({
    values: queryVector,
    topK: seedTopK,
  });

  if (seedMatches.length === 0) {
    return [];
  }

  const scoreByVectorId = new Map(
    seedMatches.map((match) => [match.id, match.score])
  );
  const seedRefs = await repository.findEntityIdsByVectorIds(
    seedMatches.map((match) => match.id)
  );

  if (seedRefs.length === 0) {
    return [];
  }

  // entityId → 最优（分数, 跳距）。种子为 hop 0。
  const reached = new Map<string, Reach>();

  for (const ref of seedRefs) {
    const score = scoreByVectorId.get(ref.vectorId) ?? 0;
    const prev = reached.get(ref.entityId);

    if (!prev || score > prev.score) {
      reached.set(ref.entityId, { score, hops: 0 });
    }
  }

  // 2. 沿出边 BFS 扩展，每跳分数 ×hopDecay；分数严格递减保证收敛（防环）。
  let frontier = [...reached.keys()];

  for (let hop = 1; hop <= maxHops && frontier.length > 0; hop += 1) {
    const outgoing = await repository.findActiveOutgoingEdges(
      frontier,
      scopeId
    );
    const nextFrontier = new Set<string>();

    for (const edge of outgoing) {
      const src = reached.get(edge.srcEntityId);

      if (!src) {
        continue;
      }

      const dstScore = src.score * hopDecay;
      const prev = reached.get(edge.dstEntityId);

      if (!prev || dstScore > prev.score) {
        reached.set(edge.dstEntityId, { score: dstScore, hops: src.hops + 1 });
        nextFrontier.add(edge.dstEntityId);
      }
    }

    frontier = [...nextFrontier];
  }

  // 3. 收集到达实体作主语的所有活跃陈述。
  const reachedEntityIds = [...reached.keys()];
  const statements = await repository.findActiveStatementsBySubjects(
    reachedEntityIds,
    scopeId
  );

  if (statements.length === 0) {
    return [];
  }

  // 4. 钻取 provenance → 每条陈述取首个非空 L1 资产。
  const provenanceRefs = await repository.findProvenanceByMemoryIds(
    "statement",
    statements.map((statement) => statement.id)
  );
  const assetByStatement = new Map<string, string>();

  for (const ref of provenanceRefs) {
    if (ref.assetId && !assetByStatement.has(ref.memoryId)) {
      assetByStatement.set(ref.memoryId, ref.assetId);
    }
  }

  // 5. 组装图证据，按关联强度降序，截断到上限。
  const hits: GraphRecallHit[] = statements.map((statement) => {
    const reach = reached.get(statement.subjectEntityId);

    return {
      statement,
      assetId: assetByStatement.get(statement.id) ?? null,
      score: reach?.score ?? 0,
      hops: reach?.hops ?? 0,
    };
  });

  hits.sort((left, right) => right.score - left.score);

  return hits.slice(0, maxStatements);
};
