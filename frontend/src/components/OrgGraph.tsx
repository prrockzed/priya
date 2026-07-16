"use client";

import { useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import type { GraphData, GraphNode } from "@/lib/api";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

const NODE_COLOR: Record<string, string> = {
  priya: "#c99a4b",
  manager: "#2f96a1",
  task: "#8b92a6",
};

const TASK_STATE_COLOR: Record<string, string> = {
  needs_approval: "#c6432b",
  needs_input: "#e8a33d",
  blocked: "#c6432b",
  failed: "#c6432b",
  in_review: "#2f96a1",
  in_progress: "#e0b968",
  done: "#8b92a6",
  inbox: "#8b92a6",
  assigned: "#8b92a6",
  changes_requested: "#e8a33d",
};

function colorFor(node: GraphNode): string {
  if (node.group === "task" && node.state) return TASK_STATE_COLOR[node.state] ?? NODE_COLOR.task;
  return NODE_COLOR[node.group] ?? "#8b92a6";
}

function sizeFor(node: GraphNode): number {
  if (node.group === "priya") return 14;
  if (node.group === "manager") return 9;
  return 4;
}

export function OrgGraph({ data, onNodeClick }: { data: GraphData; onNodeClick?: (node: GraphNode) => void }) {
  const graphRef = useRef<any>(null);
  // onEngineStop fires from inside the (dynamically-imported) library once its own instance is
  // ready and the physics simulation has settled — unlike a mount-time effect, which can run
  // before next/dynamic finishes lazily mounting the real component (ref stays null then).
  const hasFitted = useRef(false);

  const graphData = useMemo(
    () => ({
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.links.map((l) => ({ ...l })),
    }),
    [data],
  );

  function handleEngineStop() {
    if (hasFitted.current) return;
    hasFitted.current = true;
    graphRef.current?.zoomToFit(600, 50);
  }

  return (
    <ForceGraph3D
      ref={graphRef}
      graphData={graphData}
      backgroundColor="#0a0d16"
      nodeLabel={(n: any) => `${n.name} (${n.kind})`}
      nodeColor={(n: any) => colorFor(n)}
      nodeVal={(n: any) => sizeFor(n)}
      linkColor={() => "#232838"}
      linkOpacity={0.6}
      linkWidth={0.6}
      onNodeClick={(n: any) => onNodeClick?.(n)}
      onEngineStop={handleEngineStop}
      showNavInfo={false}
    />
  );
}
