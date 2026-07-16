import yaml from "js-yaml";

/** Parses `---\nyaml\n---\nbody` markdown frontmatter, used by agents/commands/skills alike. */
export function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  const [, yamlBlock, body] = match;
  const parsed = yaml.load(yamlBlock);
  return { frontmatter: (parsed as Record<string, unknown>) ?? {}, body };
}
