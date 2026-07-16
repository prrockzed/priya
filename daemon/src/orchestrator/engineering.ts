import path from "node:path";
import { runClaudeCode } from "../runners/claude-code.js";
import { assignTask, transitionTask, recordRun, getTask, getLatestRun } from "./tasks.js";
import type { TaskState } from "./tasks.js";
import { eventBus } from "../events/bus.js";
import { acquireSlot } from "./concurrency.js";
import { recordUsage } from "./budgets.js";
import type { RunEvent, RunResult } from "../runners/types.js";

export interface DelegateOptions {
  cwd: string;
  model: string;
  worktree?: string;
  mcpConfig?: string;
  systemPromptAppend?: string;
  allowedTools?: string[];
}

/** Engineering workers own an isolated worktree/branch, so these are safe to pre-allow
 *  rather than leaving them to the auto-mode classifier — which, in a headless run with no
 *  human to ask, denies anything it isn't confident about (verified: a fresh scratch repo
 *  had a plain Write and `git commit` both denied under --permission-mode auto alone). */
const DEFAULT_ENGINEERING_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash(git *)"];
const AGENT_ID = "engineering-worker";

function worktreePath(cwd: string, worktree: string): string {
  return path.join(cwd, ".claude", "worktrees", worktree);
}

async function runAndRecord(taskId: string, model: string, spec: Parameters<typeof runClaudeCode>[0]): Promise<RunResult> {
  const startedAt = new Date();
  const release = await acquireSlot();
  try {
    const { events, done } = runClaudeCode(spec);
    events.on("event", (event: RunEvent) => eventBus.publish("run.event", { taskId, event }));

    const result = await done;
    await recordRun({
      taskId,
      agentId: AGENT_ID,
      runner: "claude-code",
      model,
      sessionId: result.sessionId,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      tokensCache: result.tokensCache,
      costUsd: result.costUsd,
      estimated: result.estimated,
      status: result.ok ? "done" : "failed",
      startedAt,
      endedAt: new Date(),
    });
    await recordUsage(AGENT_ID, result.tokensIn, result.tokensOut, result.costUsd);
    return result;
  } catch (err) {
    await recordRun({
      taskId,
      agentId: AGENT_ID,
      runner: "claude-code",
      model,
      tokensIn: 0,
      tokensOut: 0,
      tokensCache: 0,
      costUsd: null,
      estimated: false,
      status: "failed",
      startedAt,
      endedAt: new Date(),
    });
    throw err;
  } finally {
    release();
  }
}

function nextStateFor(result: RunResult): { state: TaskState; reason: string } {
  const blocked = result.permissionDenials.length > 0;
  if (!result.ok) return { state: "failed", reason: result.resultText.slice(0, 500) };
  if (blocked) {
    return {
      state: "blocked",
      reason: `Blocked on ${result.permissionDenials.length} denied action(s): ${result.permissionDenials.map((d) => d.toolName).join(", ")}`,
    };
  }
  return { state: "in_review", reason: result.resultText.slice(0, 500) };
}

/** Runs one worker session and drives the task to its resulting state, marking it `failed` if
 *  the run throws. Shared by the initial delegation and the review (changes-requested) loop. */
async function runStage(
  taskId: string,
  model: string,
  spec: Parameters<typeof runClaudeCode>[0],
): Promise<RunResult> {
  try {
    const result = await runAndRecord(taskId, model, spec);
    const { state, reason } = nextStateFor(result);
    await transitionTask(taskId, state, AGENT_ID, reason);
    return result;
  } catch (err) {
    await transitionTask(taskId, "failed", AGENT_ID, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/**
 * Minimal Phase-1/2 stand-in for the full Engineering manager (a later pass adds capability
 * routing across all managers). Runs one worker session for one task, end to end:
 * assigned -> in_progress -> in_review | blocked | failed.
 */
export async function delegateToEngineering(taskId: string, opts: DelegateOptions): Promise<RunResult> {
  await assignTask(taskId, "engineering-manager", "priya");
  await transitionTask(taskId, "in_progress", "engineering-manager");

  const task = await getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  return runStage(taskId, opts.model, {
    prompt: `${task.title}\n\n${task.body ?? ""}`.trim(),
    cwd: opts.cwd,
    model: opts.model,
    worktree: opts.worktree,
    mcpConfig: opts.mcpConfig,
    systemPromptAppend: opts.systemPromptAppend,
    allowedTools: opts.allowedTools ?? DEFAULT_ENGINEERING_TOOLS,
    permissionMode: "auto",
    sessionName: `priya-eng-${taskId.slice(0, 8)}`,
  });
}

/**
 * Review feedback loop: resumes the task's most recent worker session (via Claude Code's own
 * --resume) instead of starting over, so the worker keeps the context of what it already did.
 * Requires the original run to have used a worktree (opts.cwd/opts.worktree from that run).
 */
export async function requestChanges(taskId: string, feedback: string, opts: DelegateOptions): Promise<RunResult> {
  const priorRun = await getLatestRun(taskId);
  if (!priorRun?.sessionId) {
    throw new Error(`Task ${taskId} has no resumable prior run (no session_id recorded)`);
  }

  await transitionTask(taskId, "changes_requested", "priya", feedback.slice(0, 500));
  await transitionTask(taskId, "in_progress", "engineering-manager");

  const cwd = opts.worktree ? worktreePath(opts.cwd, opts.worktree) : opts.cwd;

  return runStage(taskId, opts.model, {
    prompt: feedback,
    cwd,
    model: opts.model,
    resumeSessionId: priorRun.sessionId,
    allowedTools: opts.allowedTools ?? DEFAULT_ENGINEERING_TOOLS,
    permissionMode: "auto",
    sessionName: `priya-eng-${taskId.slice(0, 8)}-review`,
  });
}
