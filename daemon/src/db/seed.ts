import { eq } from "drizzle-orm";
import { db, client } from "./client.js";
import { projects, agents } from "./schema.js";
import { env } from "../config/env.js";
import { loadManagers } from "../managers/registry.js";

async function upsertProject(id: string, name: string, path: string): Promise<void> {
  const existing = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (existing) return;
  await db.insert(projects).values({ id, name, path, vaultSubdir: name, active: true });
}

async function upsertAgent(a: typeof agents.$inferInsert): Promise<void> {
  const existing = await db.query.agents.findFirst({ where: eq(agents.id, a.id) });
  if (existing) {
    await db.update(agents).set(a).where(eq(agents.id, a.id));
  } else {
    await db.insert(agents).values(a);
  }
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

  // Load every manager defined in managers/*.yaml (§5.2) rather than hardcoding just
  // Engineering — Security, Social Media, User Research, and Fundraising exist as YAML but
  // were never actually loaded into the agents table until this fix.
  const managers = loadManagers();
  for (const m of managers) {
    await upsertAgent({
      id: m.id,
      kind: "manager",
      name: m.name,
      charter: m.charter,
      capabilities: m.capabilities,
      runner: m.runner,
      model: m.model,
      parentId: m.parent,
    });
  }

  console.log(`Seed complete: priya + ${managers.length} manager(s) (${managers.map((m) => m.id).join(", ")}).`);
  client.close();
}

main();
