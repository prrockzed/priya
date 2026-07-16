import { randomUUID } from "node:crypto";
import { eq, lte, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { wakeups } from "../db/schema.js";
import { eventBus } from "../events/bus.js";

/**
 * DB-backed wakeup queue with coalescing (PLAN.md §6.3 / Paperclip pattern): a manager "wakes"
 * on schedule or event rather than running a hot loop. Honest current scope — no manager code
 * yet consumes `wakeup.due` to act on it (only Engineering's task-triggered flow exists so
 * far); this establishes the mechanism (schedule/coalesce/process) for that to plug into.
 */
export async function scheduleWakeup(agentId: string, dueAt: Date, reason: string, coalesceKey?: string): Promise<void> {
  if (coalesceKey) {
    const existing = await db.query.wakeups.findFirst({
      where: and(eq(wakeups.agentId, agentId), eq(wakeups.coalesceKey, coalesceKey)),
    });
    if (existing) {
      await db.update(wakeups).set({ dueAt, reason }).where(eq(wakeups.id, existing.id));
      return;
    }
  }
  await db.insert(wakeups).values({ id: randomUUID(), agentId, dueAt, reason, coalesceKey });
}

export async function processDueWakeups(now: Date = new Date()): Promise<number> {
  const due = await db.query.wakeups.findMany({ where: lte(wakeups.dueAt, now) });
  for (const w of due) {
    eventBus.publish("wakeup.due", { agentId: w.agentId, reason: w.reason });
    await db.delete(wakeups).where(eq(wakeups.id, w.id));
  }
  return due.length;
}

export function startHeartbeatLoop(intervalMs = 30_000): NodeJS.Timeout {
  return setInterval(() => {
    processDueWakeups().catch((err) => eventBus.publish("wakeup.error", { message: String(err) }));
  }, intervalMs);
}
