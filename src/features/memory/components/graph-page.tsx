import type { MemoryGraphEdge, MemoryGraphEntity } from "@/core/memory/ports";
import { PageShell } from "@/features/layout/components/page-shell";
import type { GraphView } from "@/features/memory/server/memory-browse-service";
import { EmptyState, Panel } from "@/features/ui/components";

// SVG 画布尺寸与布局参数。
const WIDTH = 760;
const HEIGHT = 520;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;

interface PositionedNode {
  entity: MemoryGraphEntity;
  x: number;
  y: number;
  r: number;
}

// 环形布局：按显著性排序，最重要的居中，其余按双环分布。
// 不引 dagre——SSR 纯计算，无 JS 也能看；交互（拖拽/缩放）留作后续岛升级。
const layoutNodes = (entities: MemoryGraphEntity[]): PositionedNode[] => {
  if (entities.length === 0) {
    return [];
  }

  const maxSalience = Math.max(1, ...entities.map((entity) => entity.salience));
  const maxMention = Math.max(
    1,
    ...entities.map((entity) => entity.mentionCount)
  );

  // 节点半径：按 salience+mention 综合，3.5–9。
  const radiusOf = (entity: MemoryGraphEntity): number => {
    const weight =
      entity.salience / maxSalience + entity.mentionCount / maxMention;
    return 3.5 + Math.min(1, weight / 2) * 5.5;
  };

  const positioned: PositionedNode[] = [];
  // 第一个（最显著）居中，其余分两环。
  const [head, ...rest] = entities;
  if (head) {
    positioned.push({ entity: head, x: CX, y: CY, r: radiusOf(head) + 1.5 });
  }

  const innerCount = Math.min(rest.length, 8);
  const inner = rest.slice(0, innerCount);
  const outer = rest.slice(innerCount);

  inner.forEach((entity, index) => {
    const angle =
      (index / Math.max(1, inner.length)) * Math.PI * 2 - Math.PI / 2;
    positioned.push({
      entity,
      x: CX + Math.cos(angle) * 130,
      y: CY + Math.sin(angle) * 130,
      r: radiusOf(entity),
    });
  });

  outer.forEach((entity, index) => {
    const angle =
      (index / Math.max(1, outer.length)) * Math.PI * 2 - Math.PI / 2 + 0.3;
    positioned.push({
      entity,
      x: CX + Math.cos(angle) * 225,
      y: CY + Math.sin(angle) * 225,
      r: radiusOf(entity),
    });
  });

  return positioned;
};

// 截断长名字（标签可读）。
const truncate = (value: string, max = 14): string =>
  value.length > max ? `${value.slice(0, max)}…` : value;

export const GraphPage = ({ view }: { view: GraphView }) => {
  const { entities, edges, counts } = view;
  const nodes = layoutNodes(entities);
  const posById = new Map<string, PositionedNode>();
  for (const node of nodes) {
    posById.set(node.entity.id, node);
  }

  // 只画两端都在当前布局节点集里的边。
  const drawableEdges = edges.filter(
    (edge: MemoryGraphEdge) =>
      posById.has(edge.srcEntityId) && posById.has(edge.dstEntityId)
  );

  return (
    <PageShell
      navigationKey="graph"
      eyebrow="记忆层 · 图谱"
      title={
        <>
          记忆<em class="italic text-brass">图谱</em>
        </>
      }
      subtitle="实体、陈述与关系边构成的知识图谱，可视化你的记忆如何相互连接。节点大小按显著性，居中者最重要。"
    >
      {/* 计量 */}
      <div class="mb-5 flex flex-wrap gap-x-6 gap-y-1">
        {[
          { label: "实体", value: counts.entities },
          { label: "陈述", value: counts.statements },
          { label: "关系边", value: counts.edges },
        ].map((item) => (
          <div key={item.label} class="flex items-baseline gap-2">
            <span class="font-display text-[26px] font-medium tabular-nums text-brass">
              {item.value}
            </span>
            <span class="text-[13px] text-bone-soft">{item.label}</span>
          </div>
        ))}
      </div>

      {nodes.length === 0 ? (
        <EmptyState
          title="图谱还是空的"
          description="采集更多记忆后，处理流水线会抽取实体与关系，自动长出这张图。"
        />
      ) : (
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.6fr)]">
          {/* 图谱 SVG */}
          <Panel class="overflow-hidden p-2" variant="panel">
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              class="h-auto w-full"
              role="img"
              aria-label="记忆图谱"
            >
              {/* 边 */}
              {drawableEdges.map((edge) => {
                const src = posById.get(edge.srcEntityId);
                const dst = posById.get(edge.dstEntityId);
                if (!src || !dst) {
                  return null;
                }
                return (
                  <line
                    key={edge.id}
                    x1={src.x}
                    y1={src.y}
                    x2={dst.x}
                    y2={dst.y}
                    stroke="rgba(201,163,94,0.3)"
                    stroke-width="1"
                  />
                );
              })}
              {/* 节点 */}
              {nodes.map((node) => (
                <g key={node.entity.id}>
                  <circle cx={node.x} cy={node.y} r={node.r} fill="#c9a35e" />
                  <text
                    x={node.x + node.r + 4}
                    y={node.y + 3}
                    fill="rgba(236,228,212,0.72)"
                    style="font-family: 'JetBrains Mono', monospace; font-size: 9.5px;"
                  >
                    {truncate(node.entity.canonicalName)}
                  </text>
                </g>
              ))}
            </svg>
          </Panel>

          {/* 实体清单（按显著性） */}
          <Panel class="p-5" variant="panel">
            <h2 class="mb-3 font-display text-[17px] font-semibold text-bone">
              实体（按显著性）
            </h2>
            <div class="flex flex-col">
              {entities.slice(0, 20).map((entity, index) => (
                <div
                  key={entity.id}
                  class="flex items-center justify-between gap-3 border-b border-line-soft py-2 last:border-none"
                >
                  <div class="flex min-w-0 items-center gap-2.5">
                    <span class="font-mono text-[11px] text-bone-faint">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span class="truncate text-[13.5px] text-bone">
                      {entity.canonicalName}
                    </span>
                  </div>
                  <span class="flex-shrink-0 font-mono text-[11px] text-bone-faint">
                    {entity.type ?? "—"} · {entity.mentionCount}×
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </PageShell>
  );
};
