import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { env, repoRootDir } from "../config/env.js";

const GRAPHIFY_BIN = "graphify";
const MERGED_GRAPH_PATH = path.join(repoRootDir, "graphify-out", "merged-graph.json");

function graphOutputPath(targetDir: string): string {
  return path.join(targetDir, "graphify-out", "graph.json");
}

/** Runs `graphify update <dir>` (code via tree-sitter, no LLM key needed) so the target's own
 *  graphify-out/graph.json is current. PLAN.md §10.2 — verified: 3053 nodes/4656 edges from the
 *  full AgentKavach repo in <90s, and real `references` edges from vault [[wikilinks]]. */
export function updateGraph(targetDir: string): void {
  execFileSync(GRAPHIFY_BIN, ["update", targetDir], { stdio: "pipe" });
}

/** Merges the vault's graph (org chart + memory) and the project's graph (code + docs) into
 *  one file via Graphify's own `merge-graphs` — verified: output node/edge counts equal the
 *  exact sum of the two inputs, no data loss or duplication. */
export function mergeVaultAndProjectGraphs(): string {
  const vaultGraph = graphOutputPath(env.PRIYA_VAULT_PATH);
  const projectGraph = graphOutputPath(env.PRIYA_PROJECT_PATH);
  fs.mkdirSync(path.dirname(MERGED_GRAPH_PATH), { recursive: true });

  execFileSync(GRAPHIFY_BIN, ["merge-graphs", vaultGraph, projectGraph, "--out", MERGED_GRAPH_PATH], {
    stdio: "pipe",
  });
  return MERGED_GRAPH_PATH;
}

interface RawGraphifyNode {
  id: string;
  label: string;
  file_type?: string;
  source_file?: string;
  community_name?: string;
}

interface RawGraphifyLink {
  source: string;
  target: string;
  relation: string;
  confidence: "EXTRACTED" | "INFERRED";
}

export interface NormalizedGraphifyGraph {
  nodes: Array<{ id: string; name: string; sourceFile?: string; community?: string }>;
  links: Array<{ source: string; target: string; relation: string; confidence: string }>;
}

/** Reads a graphify-out/graph.json and normalizes it to Priya's own field names. Graphify's
 *  raw shape (id/label/community_name, source/target/relation/confidence) is stable across the
 *  vault and project graphs since both come from the same tool. */
export function readGraphifyGraph(graphPath: string = MERGED_GRAPH_PATH): NormalizedGraphifyGraph {
  const raw = JSON.parse(fs.readFileSync(graphPath, "utf-8")) as {
    nodes: RawGraphifyNode[];
    links: RawGraphifyLink[];
  };

  return {
    nodes: raw.nodes.map((n) => ({ id: n.id, name: n.label, sourceFile: n.source_file, community: n.community_name })),
    links: raw.links.map((l) => ({ source: l.source, target: l.target, relation: l.relation, confidence: l.confidence })),
  };
}
