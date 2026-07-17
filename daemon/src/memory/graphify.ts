import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { env, repoRootDir } from "../config/env.js";

const GRAPHIFY_BIN = "graphify";
export const MERGED_GRAPH_PATH = path.join(repoRootDir, "graphify-out", "merged-graph.json");

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
  community?: number;
  community_name?: string;
  repo?: string; // present only in a merge-graphs output; absent on a single-source graph.json
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

export interface CommunityNode {
  id: string;
  name: string;
  repo: string;
  fileType: string;
  memberCount: number;
  /** True if any member of this community comes from a 10-Org/*.md vault note. Graphify's own
   *  clustering can pull an org note into the SAME community as another (verified: it merged
   *  Priya.md into Fundraising-Manager.md's community because they're wikilinked) — so this is
   *  a simple presence flag for filtering, not an identity source. The org chart is built
   *  separately, straight from the agents table, which is always correct by construction. */
  containsOrgNotes: boolean;
}

export interface CommunityLink {
  source: string;
  target: string;
  weight: number;
}

/**
 * Collapses Graphify's file/function-level graph (3065 nodes for the vault+AgentKavach merge)
 * down to one node per community — Graphify's own clustering, already computed at `update`
 * time — so the dashboard renders a few hundred meaningful nodes instead of thousands of
 * individually-unreadable ones. Verified against the real merged graph: AgentKavach's 248
 * communities collapse cleanly. The vault's org notes do NOT reliably form their own
 * one-per-agent communities (see `containsOrgNotes` above) — callers must build the org chart
 * from the database, not from this function's output.
 */
export function buildCommunityGraph(graphPath: string = MERGED_GRAPH_PATH): { nodes: CommunityNode[]; links: CommunityLink[] } {
  const raw = JSON.parse(fs.readFileSync(graphPath, "utf-8")) as { nodes: RawGraphifyNode[]; links: RawGraphifyLink[] };

  const communityKey = (n: RawGraphifyNode) => `${n.repo ?? "local"}::${n.community}`;
  const nodeToCommunity = new Map<string, string>();
  const groups = new Map<string, RawGraphifyNode[]>();

  for (const n of raw.nodes) {
    const key = communityKey(n);
    nodeToCommunity.set(n.id, key);
    const group = groups.get(key);
    if (group) group.push(n);
    else groups.set(key, [n]);
  }

  const nodes: CommunityNode[] = [...groups.entries()].map(([key, members]) => {
    const fileTypeCounts = new Map<string, number>();
    for (const m of members) {
      const type = m.file_type ?? "unknown";
      fileTypeCounts.set(type, (fileTypeCounts.get(type) ?? 0) + 1);
    }
    const fileType = [...fileTypeCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

    const containsOrgNotes = members.some((m) => m.source_file?.startsWith("10-Org/"));

    return {
      id: key,
      name: members[0].community_name ?? members[0].label,
      repo: members[0].repo ?? "local",
      fileType,
      memberCount: members.length,
      containsOrgNotes,
    };
  });

  const edgeWeights = new Map<string, CommunityLink>();
  for (const link of raw.links) {
    const srcCommunity = nodeToCommunity.get(link.source);
    const dstCommunity = nodeToCommunity.get(link.target);
    if (!srcCommunity || !dstCommunity || srcCommunity === dstCommunity) continue;

    const [a, b] = [srcCommunity, dstCommunity].sort();
    const edgeKey = `${a}|${b}`;
    const existing = edgeWeights.get(edgeKey);
    if (existing) existing.weight += 1;
    else edgeWeights.set(edgeKey, { source: a, target: b, weight: 1 });
  }

  return { nodes, links: [...edgeWeights.values()] };
}
