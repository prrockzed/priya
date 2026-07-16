const DAEMON_URL = process.env.NEXT_PUBLIC_PRIYA_DAEMON_URL ?? "http://127.0.0.1:4700";

export interface Agent {
  id: string;
  kind: "priya" | "manager" | "worker_template";
  name: string;
  charter: string | null;
  capabilities: string[];
  runner: string;
  model: string;
  parentId: string | null;
}

export type TaskState =
  | "inbox"
  | "assigned"
  | "in_progress"
  | "in_review"
  | "changes_requested"
  | "needs_input"
  | "needs_approval"
  | "blocked"
  | "failed"
  | "done";

export interface Task {
  id: string;
  projectId: string;
  title: string;
  body: string | null;
  state: TaskState;
  ownerAgentId: string | null;
  createdBy: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface MetricsWindow {
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  tasksDone: number;
}

export interface MetricsSummary {
  today: MetricsWindow;
  week: MetricsWindow;
  month: MetricsWindow;
  byAgent: Array<{ day: string; agentId: string; tokensIn: number; tokensOut: number; costUsd: number; tasksDone: number }>;
}

export interface GraphNode {
  id: string;
  name: string;
  kind: string;
  group: string;
  model?: string;
  state?: string;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${DAEMON_URL}${path}`);
  if (!res.ok) throw new Error(`${path} responded ${res.status}`);
  return res.json();
}

export function fetchAgents(): Promise<Agent[]> {
  return getJson<Agent[]>("/api/agents");
}

export function fetchTasks(state?: TaskState): Promise<Task[]> {
  return getJson<Task[]>(state ? `/api/tasks?state=${state}` : "/api/tasks");
}

export function fetchMetricsSummary(): Promise<MetricsSummary> {
  return getJson<MetricsSummary>("/api/metrics/summary");
}

export function fetchGraph(): Promise<GraphData> {
  return getJson<GraphData>("/api/graph");
}
