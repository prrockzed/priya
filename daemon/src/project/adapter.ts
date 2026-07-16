import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter.js";

export interface ProjectAgent {
  name: string;
  namespace: string | null;
  description: string;
  tools: string[];
}

export interface ProjectCommand {
  name: string; // e.g. "eng:feature" or "init"
  description: string;
  argumentHint?: string;
}

export interface ProjectSkill {
  name: string;
  description: string;
}

export interface ProjectSummary {
  path: string;
  claudeMd: string | null;
  agents: ProjectAgent[];
  commands: ProjectCommand[];
  skills: ProjectSkill[];
  workflows: string[];
  hooks: string[];
  mcpServers: string[];
}

function listMarkdownFiles(dir: string): Array<{ file: string; namespace: string | null }> {
  if (!fs.existsSync(dir)) return [];
  const out: Array<{ file: string; namespace: string | null }> = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const sub of fs.readdirSync(full)) {
        if (sub.endsWith(".md")) out.push({ file: path.join(full, sub), namespace: entry.name });
      }
    } else if (entry.name.endsWith(".md")) {
      out.push({ file: full, namespace: null });
    }
  }
  return out;
}

function readAgents(claudeDir: string): ProjectAgent[] {
  return listMarkdownFiles(path.join(claudeDir, "agents")).map(({ file, namespace }) => {
    const { frontmatter } = parseFrontmatter(fs.readFileSync(file, "utf-8"));
    const toolsField = frontmatter.tools;
    const tools = typeof toolsField === "string" ? toolsField.split(",").map((t) => t.trim()) : [];
    return {
      name: String(frontmatter.name ?? path.basename(file, ".md")),
      namespace,
      description: String(frontmatter.description ?? ""),
      tools,
    };
  });
}

function readCommands(claudeDir: string): ProjectCommand[] {
  return listMarkdownFiles(path.join(claudeDir, "commands")).map(({ file, namespace }) => {
    const { frontmatter } = parseFrontmatter(fs.readFileSync(file, "utf-8"));
    const base = path.basename(file, ".md");
    return {
      name: namespace ? `${namespace}:${base}` : base,
      description: String(frontmatter.description ?? ""),
      argumentHint: frontmatter["argument-hint"] ? String(frontmatter["argument-hint"]) : undefined,
    };
  });
}

function readSkills(claudeDir: string): ProjectSkill[] {
  const skillsDir = path.join(claudeDir, "skills");
  if (!fs.existsSync(skillsDir)) return [];
  const skills: ProjectSkill[] = [];
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;
    const { frontmatter } = parseFrontmatter(fs.readFileSync(skillFile, "utf-8"));
    skills.push({
      name: String(frontmatter.name ?? entry.name),
      description: String(frontmatter.description ?? ""),
    });
  }
  return skills;
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile());
}

function readMcpServers(projectPath: string): string[] {
  const mcpPath = path.join(projectPath, ".mcp.json");
  if (!fs.existsSync(mcpPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
    return Object.keys(parsed.mcpServers ?? {});
  } catch {
    return [];
  }
}

/** Scans a target project's `.claude/` toolkit so managers can use the project's own
 *  agents/commands/skills/hooks/MCP servers instead of Priya shipping duplicates (PLAN.md §9). */
export function scanProject(projectPath: string): ProjectSummary {
  const claudeDir = path.join(projectPath, ".claude");
  const claudeMdPath = path.join(projectPath, "CLAUDE.md");

  return {
    path: projectPath,
    claudeMd: fs.existsSync(claudeMdPath) ? fs.readFileSync(claudeMdPath, "utf-8") : null,
    agents: readAgents(claudeDir),
    commands: readCommands(claudeDir),
    skills: readSkills(claudeDir),
    workflows: listFiles(path.join(claudeDir, "workflows")),
    hooks: listFiles(path.join(claudeDir, "hooks")),
    mcpServers: readMcpServers(projectPath),
  };
}
