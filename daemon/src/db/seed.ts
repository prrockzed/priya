import { eq } from "drizzle-orm";
import { db, client } from "./client.js";
import { projects, agents } from "./schema.js";
import { env } from "../config/env.js";

async function upsertProject(id: string, name: string, path: string): Promise<void> {
  const existing = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (existing) return;
  await db.insert(projects).values({ id, name, path, vaultSubdir: name, active: true });
}

async function upsertAgent(a: typeof agents.$inferInsert): Promise<void> {
  const existing = await db.query.agents.findFirst({ where: eq(agents.id, a.id) });
  if (existing) return;
  await db.insert(agents).values(a);
}

async function main(): Promise<void> {
  await upsertProject("agentkavach", "AgentKavach", env.PRIYA_PROJECT_PATH);

  await upsertAgent({
    id: "priya",
    kind: "priya",
    name: "Priya",
    charter: "Orchestrator (CEO). Receives all tasks, delegates to managers, escalates approvals/input.",
    capabilities: ["route", "plan", "escalate"],
    runner: "claude-code",
    model: "claude-fable-5",
  });

  await upsertAgent({
    id: "engineering-manager",
    kind: "manager",
    name: "Engineering Manager",
    charter: "Features, bugs, refactors, tests, PRs for the active project.",
    capabilities: ["feature", "bug", "refactor", "test", "pr"],
    runner: "claude-code",
    model: "claude-sonnet-5",
    parentId: "priya",
  });

  console.log("Seed complete.");
  client.close();
}

main();
