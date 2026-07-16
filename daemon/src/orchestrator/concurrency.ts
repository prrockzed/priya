import { env } from "../config/env.js";

let active = 0;
const queue: Array<() => void> = [];

/** Enforces PRIYA_CONCURRENCY (§17 decision: 5) parallel worker runs. Callers must invoke the
 *  returned release function exactly once, in a `finally` block. */
export async function acquireSlot(): Promise<() => void> {
  if (active >= env.PRIYA_CONCURRENCY) {
    // Woken by release() handing this waiter the slot directly — active is already correct.
    await new Promise<void>((resolve) => queue.push(resolve));
    return release;
  }
  active++;
  return release;
}

function release(): void {
  const next = queue.shift();
  if (next) {
    next();
  } else {
    active--;
  }
}

export function activeCount(): number {
  return active;
}
