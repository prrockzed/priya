"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetchAgents, fetchTasks, fetchMetricsSummary, fetchGraph, type Agent, type GraphNode } from "@/lib/api";
import { OrgGraph } from "@/components/OrgGraph";
import { MetricsRail } from "@/components/MetricsRail";
import { TaskPanel } from "@/components/TaskPanel";

const REFRESH_MS = 4000;

export default function Dashboard() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const { data: agents } = useSWR("agents", fetchAgents, { refreshInterval: REFRESH_MS });
  const { data: tasks } = useSWR("tasks", () => fetchTasks(), { refreshInterval: REFRESH_MS });
  const { data: metrics } = useSWR("metrics", fetchMetricsSummary, { refreshInterval: REFRESH_MS });
  const { data: graph } = useSWR("graph", fetchGraph, { refreshInterval: REFRESH_MS });

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
        <span className="font-mono text-xs text-mist">{new Date().toLocaleDateString()}</span>
      </header>

      {metrics && <MetricsRail metrics={metrics} concurrency={5} activeCount={tasks?.filter((t) => t.state === "in_progress").length ?? 0} />}

      <div className="relative flex-1">
        {graph && graph.nodes.length > 0 ? (
          <OrgGraph data={graph} onNodeClick={handleNodeClick} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="font-display italic text-mist">No org data yet — run `npm run seed --workspace daemon`.</p>
          </div>
        )}

        {selectedAgent && tasks && (
          <TaskPanel agent={selectedAgent} tasks={tasks} onClose={() => setSelectedAgentId(null)} />
        )}
      </div>
    </main>
  );
}
