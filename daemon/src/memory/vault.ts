import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { parseFrontmatter } from "../project/frontmatter.js";
import { env } from "../config/env.js";

/** Patterns that must never land in the vault (PLAN.md §10.1 write-path redaction). Not
 *  exhaustive — a real secret scanner (like AgentKavach's own) belongs here eventually; this
 *  covers the common, high-confidence cases so a stray key can't get written by accident. */
const SECRET_PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/, // AWS access key ID
  /sk-[A-Za-z0-9]{20,}/, // OpenAI/Anthropic-style API key
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, // PEM private key
  /ghp_[A-Za-z0-9]{36}/, // GitHub personal access token
  /xox[baprs]-[A-Za-z0-9-]{10,}/, // Slack token
];

export class SecretDetectedError extends Error {
  constructor(pattern: string) {
    super(`Refusing to write to vault: content matches secret pattern ${pattern}`);
  }
}

function assertNoSecrets(text: string): void {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(text)) throw new SecretDetectedError(pattern.source);
  }
}

export interface NoteInput {
  relativePath: string; // e.g. "10-Org/Priya.md"
  frontmatter: Record<string, unknown>;
  body: string;
}

export function writeNote({ relativePath, frontmatter, body }: NoteInput): void {
  assertNoSecrets(JSON.stringify(frontmatter));
  assertNoSecrets(body);

  const fullPath = path.join(env.PRIYA_VAULT_PATH, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });

  const yamlBlock = yaml.dump(frontmatter).trimEnd();
  const content = `---\n${yamlBlock}\n---\n\n${body}\n`;
  fs.writeFileSync(fullPath, content, "utf-8");
}

export function readNote(relativePath: string): { frontmatter: Record<string, unknown>; body: string } | null {
  const fullPath = path.join(env.PRIYA_VAULT_PATH, relativePath);
  if (!fs.existsSync(fullPath)) return null;

  const { frontmatter, body } = parseFrontmatter(fs.readFileSync(fullPath, "utf-8"));
  return { frontmatter, body: body.trimStart() };
}
