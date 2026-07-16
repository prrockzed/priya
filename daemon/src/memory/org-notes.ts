import { db } from "../db/client.js";
import { writeNote } from "./vault.js";

function slugify(name: string): string {
  return name.replace(/[^a-zA-Z0-9-]+/g, "-");
}

/**
 * Writes one vault note per agent into 10-Org/ (PLAN.md §10.2) — frontmatter + a [[wikilink]]
 * to its parent, so Graphify's extraction of the vault produces the org-chart shape directly
 * from real agent rows instead of a hand-built graph.
 */
export async function generateOrgNotes(): Promise<string[]> {
  const agents = await db.query.agents.findMany();
  const written: string[] = [];

  for (const agent of agents) {
    const relativePath = `10-Org/${slugify(agent.name)}.md`;
    const parentName = agent.parentId ? agents.find((a) => a.id === agent.parentId)?.name : undefined;

    writeNote({
      relativePath,
      frontmatter: {
        type: "agent",
        id: agent.id,
        role: agent.kind,
        model: agent.model,
        runner: agent.runner,
        capabilities: agent.capabilities,
      },
      body: [
        `# ${agent.name}`,
        "",
        agent.charter ?? "",
        "",
        parentName ? `Reports to: [[${parentName}]]` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    written.push(relativePath);
  }

  return written;
}
