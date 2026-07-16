import { randomUUID } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { tasks, taskEvents, runs } from "../db/schema.js";
import { eventBus } from "../events/bus.js";

export type TaskState = (typeof tasks.$inferSelect)["state"];

async function recordEvent(
  taskId: string,
  type: string,
  actor: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(taskEvents).values({
    id: randomUUID(),
    taskId,
    type,
    payload,
    actor,
    ts: new Date(),
  });
  eventBus.publish("task.event", { taskId, type, actor, payload });
}

export async function createTask(input: {
  projectId: string;
  title: string;
  body?: string;
  createdBy: string;
  priority?: number;
  goalId?: string;
  parentTaskId?: string;
}): Promise<string> {
  const id = randomUUID();
  const now = new Date();
  await db.insert(tasks).values({
    id,
    projectId: input.projectId,
    goalId: input.goalId,
    parentTaskId: input.parentTaskId,
    title: input.title,
    body: input.body,
    state: "inbox",
    createdBy: input.createdBy,
    priority: input.priority ?? 0,
    createdAt: now,
    updatedAt: now,
  });
  await recordEvent(id, "created", input.createdBy, { title: input.title });
  return id;
}

export async function transitionTask(
  taskId: string,
  state: TaskState,
  actor: string,
  reason?: string,
): Promise<void> {
  await db
    .update(tasks)
    .set({ state, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
  await recordEvent(taskId, "state_changed", actor, { state, reason });
}

export async function assignTask(taskId: string, ownerAgentId: string, actor: string): Promise<void> {
  await db
    .update(tasks)
    .set({ ownerAgentId, state: "assigned", updatedAt: new Date() })
    .where(eq(tasks.id, taskId));
  await recordEvent(taskId, "assigned", actor, { ownerAgentId });
}

export async function getTask(taskId: string): Promise<typeof tasks.$inferSelect | undefined> {
  return db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
}

export async function recordRun(input: {
  taskId: string;
  agentId: string;
  runner: string;
  model: string;
  sessionId?: string | null;
  transcriptPath?: string;
  tokensIn: number;
  tokensOut: number;
  tokensCache: number;
  costUsd: number | null;
  estimated: boolean;
  status: "running" | "done" | "failed" | "stopped";
  startedAt: Date;
  endedAt?: Date;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(runs).values({ id, ...input });
  return id;
}

export async function getLatestRun(taskId: string): Promise<typeof runs.$inferSelect | undefined> {
  return db.query.runs.findFirst({
    where: eq(runs.taskId, taskId),
    orderBy: desc(runs.startedAt),
  });
}
