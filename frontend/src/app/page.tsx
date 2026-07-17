"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetchAgents, fetchTasks, fetchMetricsSummary, fetchGraph, fetchKnowledgeGraph, type Agent, type GraphNode } from "@/lib/api";
import { OrgGraph } from "@/components/OrgGraph";
import { MetricsRail } from "@/components/MetricsRail";
import { TaskPanel } from "@/components/TaskPanel";

const REFRESH_MS = 4000;
type View = "org" | "knowledge";

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const base = "px-3 py-1 font-mono text-xs rounded border transition-colors";
  const active = "border-brass text-brass-bright";
  const inactive = "border-void-line text-mist hover:text-parchment";
  return (
    <div className="flex gap-2">
      <button className={`${base} ${view === "org" ? active : inactive}`} onClick={() => onChange("org")}>
        Org
      </button>
      <button className={`${base} ${view === "knowledge" ? active : inactive}`} onClick={() => onChange("knowledge")}>
        Knowledge
      </button>
    </div>
  );
}

export default function Dashboard() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [view, setView] = useState<View>("org");

  const { data: agents } = useSWR("agents", fetchAgents, { refreshInterval: REFRESH_MS });
  const { data: tasks } = useSWR("tasks", () => fetchTasks(), { refreshInterval: REFRESH_MS });
  const { data: metrics } = useSWR("metrics", fetchMetricsSummary, { refreshInterval: REFRESH_MS });
  const { data: orgGraph } = useSWR("graph", fetchGraph, { refreshInterval: REFRESH_MS });
  // The knowledge graph only changes when `npm run graphify-update` is rerun, not every 4s.
  const { data: knowledgeGraph } = useSWR("graph/knowledge", fetchKnowledgeGraph);

  const activeGraph = view === "org" ? orgGraph : knowledgeGraph;
  const selectedAgent: Agent | undefined = agents?.find((a) => a.id === selectedAgentId);

  function handleNodeClick(node: GraphNode) {
    if (node.group === "priya" || node.group === "manager") {
      setSelectedAgentId(node.id);
    }
  }

  return (
    <main className="relative flex h-screen flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-void-line px-6 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl italic text-brass-bright">Priya</h1>
          <span className="font-mono text-xs text-mist">AgentKavach</span>
        </div>
        <div className="flex items-center gap-4">
          <ViewToggle view={view} onChange={setView} />
          <span className="font-mono text-xs text-mist">{new Date().toLocaleDateString()}</span>
        </div>
      </header>

      {metrics && <MetricsRail metrics={metrics} concurrency={5} activeCount={tasks?.filter((t) => t.state === "in_progress").length ?? 0} />}

      <div className="relative flex-1">
        {activeGraph && activeGraph.nodes.length > 0 ? (
          <OrgGraph data={activeGraph} onNodeClick={handleNodeClick} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="font-display italic text-mist">
              {view === "org"
                ? "No org data yet — run `npm run seed --workspace daemon`."
                : knowledgeGraph?.reason ?? "Loading knowledge graph..."}
            </p>
          </div>
        )}

        {view === "org" && selectedAgent && tasks && (
          <TaskPanel agent={selectedAgent} tasks={tasks} onClose={() => setSelectedAgentId(null)} />
        )}
      </div>
    </main>
  );
}
