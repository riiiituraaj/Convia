"use client";

import React, { memo, useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { MissionEdge, MissionNode } from "@/lib/types";
import { prettyLabel } from "@/lib/ui";

const CUSTOM_NODE_TYPE = "customNode" as const;

interface MissionGraphProps {
  nodes: MissionNode[];
  edges: MissionEdge[];
  onSelectNode?: (node: MissionNode) => void;
}

interface MissionFlowNodeData {
  [key: string]: unknown;
  title: string;
  node_type: MissionNode["node_type"];
  status: MissionNode["status"];
  progress: number;
  rawNode: MissionNode;
}

type MissionFlowNode = Node<MissionFlowNodeData, typeof CUSTOM_NODE_TYPE>;

// The API stores (0, 0) until a node has been placed by the planning agent, so unplaced
// nodes are staggered on a deterministic grid instead of stacking on a single spot.
const FALLBACK_ORIGIN = { x: 80, y: 60 };
const FALLBACK_SPACING = { x: 260, y: 140 };
const FALLBACK_COLUMNS = 3;

const EDGE_COLORS: Record<string, string> = {
  BLOCKS: "#F04444",
  RELIES_ON: "#1677E8",
  FEEDS_INTO: "#25A866",
};

const isPositioned = (node: MissionNode) =>
  Number.isFinite(node.position_x) &&
  Number.isFinite(node.position_y) &&
  (node.position_x !== 0 || node.position_y !== 0);

const resolvePosition = (node: MissionNode, index: number) => {
  if (isPositioned(node)) {
    return { x: node.position_x, y: node.position_y };
  }

  return {
    x: FALLBACK_ORIGIN.x + (index % FALLBACK_COLUMNS) * FALLBACK_SPACING.x,
    y: FALLBACK_ORIGIN.y + Math.floor(index / FALLBACK_COLUMNS) * FALLBACK_SPACING.y,
  };
};

// Guards the progress bar against out-of-range or non-numeric API values.
const clampProgress = (progress: number): number => {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, Math.round(progress)));
};

const NODE_STYLES: Record<string, { card: string; bar: string }> = {
  COMPLETED: { card: "border-brand-light bg-brand-pale", bar: "bg-brand-accent" },
  IN_PROGRESS: { card: "border-brand-accent/45 bg-surface shadow-card-hover", bar: "bg-brand-accent" },
  BLOCKED: { card: "border-[#F8D4D4] bg-danger-light", bar: "bg-danger" },
  PENDING: { card: "border-line bg-surface", bar: "bg-line-strong" },
};

const CustomMissionNode = memo(function CustomMissionNode({ data }: NodeProps<MissionFlowNode>) {
  const progress = clampProgress(data.progress);
  const style = NODE_STYLES[data.status] ?? NODE_STYLES.PENDING;

  return (
    <div
      className={`min-w-[208px] rounded-xl border p-3.5 transition-shadow duration-200 ease-out ${style.card}`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-brand-accent" />

      <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
        <span>{data.node_type}</span>
        <span>{progress}%</span>
      </div>

      <div className="mb-2.5 text-[13.5px] font-semibold leading-snug text-ink">{data.title}</div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-2 text-[11px] text-ink-muted">{prettyLabel(data.status)}</div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-0 !bg-brand-accent"
      />
    </div>
  );
});

// Declared once at module scope: React Flow warns when the node type map is recreated on render.
const nodeTypes: NodeTypes = { [CUSTOM_NODE_TYPE]: CustomMissionNode };

export const MissionGraph: React.FC<MissionGraphProps> = ({ nodes, edges, onSelectNode }) => {
  const flowNodes: MissionFlowNode[] = useMemo(() => {
    return nodes.map((node, index) => ({
      id: node.id,
      type: CUSTOM_NODE_TYPE,
      position: resolvePosition(node, index),
      ariaLabel: `${node.title} - ${node.node_type}, ${node.status}, ${clampProgress(node.progress)}% complete`,
      data: {
        title: node.title,
        node_type: node.node_type,
        status: node.status,
        progress: node.progress,
        rawNode: node,
      },
    }));
  }, [nodes]);

  const flowEdges: Edge[] = useMemo(() => {
    return edges.map((edge) => {
      const color = EDGE_COLORS[edge.relationship_type] ?? "#25A866";

      return {
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        animated: edge.relationship_type === "BLOCKS",
        label: edge.relationship_type,
        labelStyle: { fill: "#52625C", fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: "#FFFFFF", fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 6,
        style: { stroke: color, strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      };
    });
  }, [edges]);

  const hasNodes = flowNodes.length > 0;

  return (
    <div
      role="region"
      aria-label="Mission dependency graph"
      className="relative h-[460px] w-full overflow-hidden rounded-xl border border-line bg-surface-muted"
    >
      {hasNodes ? (
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => onSelectNode?.(node.data.rawNode)}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.25 }}
        >
          <Background color="#E1E9E4" gap={22} size={1} />

          <Controls showInteractive={false} position="bottom-right" />

          {/* Legend is a Panel so it can never overlap the zoom controls */}
          <Panel
            position="top-left"
            className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-surface/95 px-3 py-1.5 text-[11px] text-ink-secondary backdrop-blur-sm"
          >
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-accent" /> Completed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-info" /> Relies on
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-danger" /> Blocking
            </span>
          </Panel>
        </ReactFlow>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
          <p className="text-[13px] font-semibold text-ink">No dependency nodes yet</p>
          <p className="max-w-sm text-[12px] leading-relaxed text-ink-secondary">
            The graph appears here once the planning agent decomposes this mission.
          </p>
        </div>
      )}
    </div>
  );
};

