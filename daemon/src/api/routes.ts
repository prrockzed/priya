import type { FastifyInstance } from "fastify";
import { desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { agents, tasks, metricsRollup } from "../db/schema.js";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Live org+task graph (nodes/edges) built from real daemon state — a stand-in for Graphify's
 * graph.json (PLAN.md §10.2) until Phase 4 wires that in. Every node/edge here reflects actual
 * agents and tasks, not placeholder data.
 */
async function buildGraph() {
  const allAgents = await db.query.agents.findMany();
  const allTasks = await db.query.tasks.findMany();

  const nodes = [
    ...allAgents.map((a) => ({ id: a.id, name: a.name, kind: a.kind, model: a.model, group: a.kind })),
    ...allTasks.map((t) => ({ id: `task:${t.id}`, name: t.title, kind: "task", state: t.state, group: "task" })),
  ];

  const links = [
    ...allAgents.filter((a) => a.parentId).map((a) => ({ source: a.parentId!, target: a.id })),
    ...allTasks.filter((t) => t.ownerAgentId).map((t) => ({ source: t.ownerAgentId!, target: `task:${t.id}` })),
  ];

  return { nodes, links };
}

async function buildMetricsSummary() {
  const rows = await db.query.metricsRollup.findMany();
  const today = daysAgo(0);
  const weekStart = daysAgo(6);
  const monthStart = daysAgo(29);

  const sum = (filterFn: (day: string) => boolean) =>
    rows
      .filter((r) => filterFn(r.day))
      .reduce(
        (acc, r) => ({
          tokensIn: acc.tokensIn + r.tokensIn,
          tokensOut: acc.tokensOut + r.tokensOut,
          costUsd: acc.costUsd + r.costUsd,
          tasksDone: acc.tasksDone + r.tasksDone,
        }),
        { tokensIn: 0, tokensOut: 0, costUsd: 0, tasksDone: 0 },
      );

  return {
    today: sum((d) => d === today),
    week: sum((d) => d >= weekStart),
    month: sum((d) => d >= monthStart),
    byAgent: rows,
  };
}

export function registerRoutes(app: FastifyInstance): void {
  app.get("/api/agents", async () => db.query.agents.findMany());

  app.get("/api/tasks", async (req) => {
    const { state } = req.query as { state?: string };
    const all = await db.query.tasks.findMany({ orderBy: desc(tasks.updatedAt) });
    return state ? all.filter((t) => t.state === state) : all;
  });

  app.get("/api/metrics/summary", async () => buildMetricsSummary());

  app.get("/api/graph", async () => buildGraph());
}
