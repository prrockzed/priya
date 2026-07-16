import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  vaultSubdir: text("vault_subdir").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["priya", "manager", "worker_template"] }).notNull(),
  name: text("name").notNull(),
  charter: text("charter"),
  capabilities: text("capabilities", { mode: "json" }).$type<string[]>().notNull().default([]),
  runner: text("runner").notNull(),
  model: text("model").notNull(),
  parentId: text("parent_id"),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  goalId: text("goal_id"),
  parentTaskId: text("parent_task_id"),
  title: text("title").notNull(),
  body: text("body"),
  state: text("state", {
    enum: [
      "inbox",
      "assigned",
      "in_progress",
      "in_review",
      "changes_requested",
      "needs_input",
      "needs_approval",
      "blocked",
      "failed",
      "done",
    ],
  })
    .notNull()
    .default("inbox"),
  ownerAgentId: text("owner_agent_id"),
  createdBy: text("created_by").notNull(),
  priority: integer("priority").notNull().default(0),
  approvalKind: text("approval_kind"),
  lockToken: text("lock_token"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const taskEvents = sqliteTable("task_events", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  type: text("type").notNull(),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
  actor: text("actor").notNull(),
  ts: integer("ts", { mode: "timestamp" }).notNull(),
});

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  agentId: text("agent_id").notNull(),
  runner: text("runner").notNull(),
  model: text("model").notNull(),
  /** Claude Code's own session_id — lets a later run resume this one via --resume (used for
   *  the changes_requested review loop instead of starting the worker over from scratch). */
  sessionId: text("session_id"),
  transcriptPath: text("transcript_path"),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  tokensCache: integer("tokens_cache").notNull().default(0),
  costUsd: real("cost_usd"),
  estimated: integer("estimated", { mode: "boolean" }).notNull().default(false),
  status: text("status", { enum: ["running", "done", "failed", "stopped"] })
    .notNull()
    .default("running"),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp" }),
});

export const budgets = sqliteTable(
  "budgets",
  {
    agentId: text("agent_id").notNull(),
    period: text("period", { enum: ["day", "month"] }).notNull(),
    tokensCap: integer("tokens_cap"),
    usdCap: real("usd_cap"),
    tokensUsed: integer("tokens_used").notNull().default(0),
    usdUsed: real("usd_used").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.agentId, t.period] })],
);

export const memoryNodes = sqliteTable("memory_nodes", {
  id: text("id").primaryKey(),
  path: text("path").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
  mtime: integer("mtime", { mode: "timestamp" }).notNull(),
});

export const memoryEdges = sqliteTable("memory_edges", {
  id: text("id").primaryKey(),
  srcId: text("src_id").notNull(),
  dstId: text("dst_id").notNull(),
  kind: text("kind", { enum: ["wikilink", "tag", "derived"] }).notNull(),
});

export const wakeups = sqliteTable("wakeups", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  dueAt: integer("due_at", { mode: "timestamp" }).notNull(),
  reason: text("reason").notNull(),
  coalesceKey: text("coalesce_key"),
});

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  kind: text("kind").notNull(),
  preview: text("preview", { mode: "json" }).$type<Record<string, unknown>>(),
  decided: text("decided", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  decidedAt: integer("decided_at", { mode: "timestamp" }),
});

export const metricsRollup = sqliteTable(
  "metrics_rollup",
  {
    day: text("day").notNull(),
    agentId: text("agent_id").notNull(),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
    tasksDone: integer("tasks_done").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.agentId] })],
);
