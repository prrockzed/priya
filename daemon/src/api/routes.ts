import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import { desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { tasks, metricsRollup } from "../db/schema.js";
import { buildCommunityGraph, MERGED_GRAPH_PATH } from "../memory/graphify.js";

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

/**
 * The Graphify-powered knowledge graph (PLAN.md §10.2/§10.3) — AgentKavach's actual code/docs
 * structure, collapsed to Graphify's own community clusters so it renders as a few hundred
 * meaningful nodes instead of thousands of individual files/functions. The org chart is
 * deliberately NOT derived from this — Graphify's clustering can merge an org note into a
 * different agent's community (verified: it pulled Priya.md into Fundraising Manager's
 * community because they're wikilinked), so any community touching a 10-Org/*.md note is
 * excluded here; the org chart lives in /api/graph, built straight from the agents table.
 * Requires `npm run graphify-update --workspace daemon` to have been run at least once; returns
 * an empty graph with a clear reason otherwise rather than a 500 (generating it takes ~90s, too
 * slow for a request handler, so it's a deliberate offline step, not done on every page load).
 */
async function buildKnowledgeGraph() {
  if (!fs.existsSync(MERGED_GRAPH_PATH)) {
    return { nodes: [], links: [], generated: false, reason: "Run `npm run graphify-update --workspace daemon` first." };
  }

  const { nodes: communities, links } = buildCommunityGraph(MERGED_GRAPH_PATH);
  const codeCommunities = communities.filter((c) => !c.containsOrgNotes);
  const codeIds = new Set(codeCommunities.map((c) => c.id));

  const nodes = codeCommunities.map((c) => ({ id: c.id, name: c.name, kind: "community", group: c.fileType, memberCount: c.memberCount }));
  const filteredLinks = links.filter((l) => codeIds.has(l.source) && codeIds.has(l.target));

  return { nodes, links: filteredLinks, generated: true };
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

  app.get("/api/graph/knowledge", async () => buildKnowledgeGraph());
}
